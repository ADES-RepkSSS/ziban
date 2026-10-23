#requires -Version 5.1
<#
  字伴 Windows 屏幕取词宿主（常驻 PowerShell 进程）
  =================================================

  职责只有两件：
  1. 以物理像素截取光标周围的一小块屏幕；
  2. 用 Windows 自带的 WinRT OCR（Windows.Media.Ocr）识别中文。

  为什么用常驻进程：
  - PowerShell 每次启动 + Add-Type + WinRT 初始化要 0.6–1s，做成一遍就太慢；
  - Node 侧只启动一次，之后用 NDJSON（一行一个 JSON）stdin/stdout 通信，
    实测一帧约 260–420 DIP 宽的截屏 + OCR 约 30–80ms（Windows 11 / 200% DPI）。

  输入（每行一个 JSON）：
    {"id":"1","cmd":"capture","widthDip":340,"heightDip":180}
    {"id":"2","cmd":"ocr-file","path":"C:\\...\\sample.png"}
    {"id":"3","cmd":"ping"}
    {"id":"4","cmd":"quit"}

  输出（每行一个 JSON）：
    {"ready":true,"engine":"winrt","language":"zh-Hans-CN","languages":[...]}
    {"id":"1","ok":true,"width":680,"height":360,"scale":2,"dpi":96,
     "origin":{"x":..,"y":..},"cursor":{"x":..,"y":..},
     "captureMs":12,"ocrMs":40,"lines":[{"text":"验 证 码","words":[...]}]}
    {"id":"1","ok":false,"code":"NO_ZH_OCR","error":"..."}

  隐私：
  - 只截光标周围的小区域，不截全屏；
  - 截图写到 %TEMP% 后立刻删除，不保留历史；
  - 识别全部在本机完成，不联网。

  维护注意：
  - 这个脚本必须兼容 Windows PowerShell 5.1（Windows 10/11 自带）；
    不要用 PowerShell 7 专有语法（如 ??、-AsArray）。
  - 进程必须是 Per-Monitor DPI Aware，否则 200% 缩放下截到的坐标会偏。
  - OCR 语言包不在时不要假装能识别；输出 NO_ZH_OCR 让 UI 引导用户安装。
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# ---------------------------------------------------------------------------
# 1. Win32：DPI 感知、光标位置、显示器 DPI
# ---------------------------------------------------------------------------
if (-not ('ZibanWin32' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class ZibanWin32
{
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromPoint(POINT point, uint flags);
    [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
    [DllImport("shcore.dll")] public static extern int GetDpiForMonitor(IntPtr monitor, int dpiType, out uint dpiX, out uint dpiY);

    public const uint MONITOR_DEFAULTTONEAREST = 2;
    public const int MDT_EFFECTIVE_DPI = 0;

    public static void MakePerMonitorAware()
    {
        // -4 = DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2（Win10 1703+）。
        try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch { }
        try { SetProcessDPIAware(); } catch { }
    }

    public static bool TryGetCursor(out POINT point) { return GetCursorPos(out point); }

    public static uint GetMonitorDpi(IntPtr monitor)
    {
        uint x = 96;
        uint y = 96;
        try
        {
            if (GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, out x, out y) == 0 && x > 0) return x;
        }
        catch { }
        return 96;
    }
}
'@
}

try { [ZibanWin32]::MakePerMonitorAware() } catch { }

# ---------------------------------------------------------------------------
# 2. WinRT OCR 初始化
# ---------------------------------------------------------------------------
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null

$script:asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

function Await($WinRtTask, $ResultType) {
  $asTask = $script:asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

$availableLanguages = @()
try {
  $availableLanguages = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag })
} catch { }

$script:ocrLanguage = $null
foreach ($candidate in @('zh-Hans-CN', 'zh-Hans', 'zh-CN')) {
  if ($availableLanguages -contains $candidate) { $script:ocrLanguage = $candidate; break }
}
if ($null -eq $script:ocrLanguage) {
  $match = $availableLanguages | Where-Object { $_ -like 'zh-Hans*' } | Select-Object -First 1
  if ($match) { $script:ocrLanguage = $match }
}

$script:engine = $null
if ($null -ne $script:ocrLanguage) {
  $language = New-Object Windows.Globalization.Language $script:ocrLanguage
  $script:engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
  if ($null -eq $script:engine) {
    $script:engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  }
}

$script:tmpPrefix = 'ziban-screen-ocr-' + $PID
$script:tmpFile = Join-Path $env:TEMP ($script:tmpPrefix + '.png')
$script:tmpScaled = Join-Path $env:TEMP ($script:tmpPrefix + '-2x.png')

function Write-JsonLine($object) {
  $json = $object | ConvertTo-Json -Depth 10 -Compress
  [Console]::Out.WriteLine($json)
  [Console]::Out.Flush()
}

function Remove-TempFiles {
  foreach ($path in @($script:tmpFile, $script:tmpScaled)) {
    try { if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue } } catch { }
  }
}

# ---------------------------------------------------------------------------
# 3. 截屏
# ---------------------------------------------------------------------------
function Get-CapturePlan([double]$widthDip, [double]$heightDip) {
  $point = New-Object ZibanWin32+POINT
  if (-not [ZibanWin32]::TryGetCursor([ref]$point)) {
    throw 'CAPTURE_FAILED: 拿不到鼠标位置'
  }

  $monitor = [ZibanWin32]::MonitorFromPoint($point, [ZibanWin32]::MONITOR_DEFAULTTONEAREST)
  $info = New-Object ZibanWin32+MONITORINFO
  $info.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($info)
  if (-not [ZibanWin32]::GetMonitorInfo($monitor, [ref]$info)) {
    throw 'CAPTURE_FAILED: 拿不到显示器范围'
  }

  $dpi = [ZibanWin32]::GetMonitorDpi($monitor)
  $factor = $dpi / 96.0
  $physicalWidth = [int][Math]::Round($widthDip * $factor)
  $physicalHeight = [int][Math]::Round($heightDip * $factor)
  $physicalWidth = [Math]::Max(40, [Math]::Min($physicalWidth, $info.rcMonitor.Right - $info.rcMonitor.Left))
  $physicalHeight = [Math]::Max(40, [Math]::Min($physicalHeight, $info.rcMonitor.Bottom - $info.rcMonitor.Top))

  $left = [int][Math]::Round($point.X - $physicalWidth / 2)
  $top = [int][Math]::Round($point.Y - $physicalHeight / 2)
  $left = [Math]::Max($info.rcMonitor.Left, [Math]::Min($left, $info.rcMonitor.Right - $physicalWidth))
  $top = [Math]::Max($info.rcMonitor.Top, [Math]::Min($top, $info.rcMonitor.Bottom - $physicalHeight))

  # 100% 缩放下 14px 的界面字对 OCR 偏小，放大 2 倍更稳；200% 屏不用再放大。
  $upscale = if ($dpi -lt 144) { 2 } else { 1 }

  return [pscustomobject]@{
    x = $left
    y = $top
    width = $physicalWidth
    height = $physicalHeight
    dpi = $dpi
    upscale = $upscale
    cursorX = $point.X - $left
    cursorY = $point.Y - $top
  }
}

function Save-Capture($plan) {
  $bitmap = New-Object System.Drawing.Bitmap -ArgumentList @($plan.width, $plan.height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($plan.x, $plan.y, 0, 0, (New-Object System.Drawing.Size $plan.width, $plan.height))
  } finally {
    $graphics.Dispose()
  }

  try {
    if ($plan.upscale -gt 1) {
      $scaled = New-Object System.Drawing.Bitmap -ArgumentList @(($plan.width * $plan.upscale), ($plan.height * $plan.upscale))
      $scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
      try {
        $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $scaledGraphics.DrawImage($bitmap, 0, 0, $scaled.Width, $scaled.Height)
      } finally {
        $scaledGraphics.Dispose()
      }
      $scaled.Save($script:tmpScaled, [System.Drawing.Imaging.ImageFormat]::Png)
      $scaled.Dispose()
      return $script:tmpScaled
    }

    $bitmap.Save($script:tmpFile, [System.Drawing.Imaging.ImageFormat]::Png)
    return $script:tmpFile
  } finally {
    $bitmap.Dispose()
  }
}

# ---------------------------------------------------------------------------
# 4. OCR
# ---------------------------------------------------------------------------
function Test-MostlyBlack([string]$path) {
  # 屏幕锁着/显示器关闭时 CopyFromScreen 常拿到全黑帧。只有 OCR 一行都没认出来时
  # 才做这个检查，避免把正常的深色终端误判成锁屏。
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    try {
      $dark = 0
      $total = 0
      $step = 20
      for ($y = 0; $y -lt $bmp.Height; $y += $step) {
        for ($x = 0; $x -lt $bmp.Width; $x += $step) {
          $pixel = $bmp.GetPixel($x, $y)
          if (($pixel.R + $pixel.G + $pixel.B) -lt 30) { $dark += 1 }
          $total += 1
        }
      }
      return ($total -gt 0 -and ($dark / $total) -gt 0.98)
    } finally {
      $bmp.Dispose()
    }
  } catch {
    return $false
  }
}

function Invoke-OcrFile([string]$path) {
  if ($null -eq $script:engine) {
    throw 'NO_ZH_OCR: 这台电脑没有中文 OCR 语言包'
  }

  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    try {
      $result = Await ($script:engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
      $lines = @()
      foreach ($line in $result.Lines) {
        $words = @()
        foreach ($word in $line.Words) {
          $rect = $word.BoundingRect
          $words += [ordered]@{
            text = [string]$word.Text
            bbox = [ordered]@{
              x = [double]$rect.X
              y = [double]$rect.Y
              width = [double]$rect.Width
              height = [double]$rect.Height
            }
          }
        }
        $lines += [ordered]@{ text = [string]$line.Text; chars = [object[]]$words }
      }
      return [pscustomobject]@{
        width = [int]$decoder.PixelWidth
        height = [int]$decoder.PixelHeight
        lines = [object[]]$lines
      }
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

# ---------------------------------------------------------------------------
# 5. 主循环
# ---------------------------------------------------------------------------
$ready = [ordered]@{
  ready = $true
  engine = 'winrt'
  language = $script:ocrLanguage
  languages = [object[]]$availableLanguages
  ok = ($null -ne $script:engine)
}
if ($null -eq $script:engine) {
  $ready.errorCode = 'NO_ZH_OCR'
  $ready.error = '没有中文 OCR 语言包。请在 Windows 设置 → 时间和语言 → 语言和区域里添加中文（简体）的“光学字符识别”。'
}
Write-JsonLine $ready

try {
  while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $request = $null
    $id = ''
    $command = ''
    try {
      $request = $line | ConvertFrom-Json
      $id = [string]$request.id
      $command = [string]$request.cmd
    } catch {
      Write-JsonLine ([ordered]@{ id = $id; ok = $false; code = 'BAD_REQUEST'; error = '看不懂这条请求' })
      continue
    }

    if ($command -eq 'quit') { break }
    if ($command -eq 'ping') {
      Write-JsonLine ([ordered]@{ id = $id; ok = $true; pong = $true })
      continue
    }

    if ($command -eq 'capture') {
      $captureWatch = [System.Diagnostics.Stopwatch]::StartNew()
      $capturePath = $null
      try {
        $widthDip = if ($null -ne $request.widthDip) { [double]$request.widthDip } else { 340 }
        $heightDip = if ($null -ne $request.heightDip) { [double]$request.heightDip } else { 180 }
        $plan = Get-CapturePlan $widthDip $heightDip
        $capturePath = Save-Capture $plan
        # 仅调试：设置 ZIBAN_OCR_DEBUG=路径 可保留最后一帧，默认绝不落盘。
        if (-not [string]::IsNullOrWhiteSpace($env:ZIBAN_OCR_DEBUG)) {
          try { Copy-Item -LiteralPath $capturePath -Destination $env:ZIBAN_OCR_DEBUG -Force } catch { }
        }
        $captureWatch.Stop()
        $ocrWatch = [System.Diagnostics.Stopwatch]::StartNew()
        $page = Invoke-OcrFile $capturePath
        if ($page.lines.Count -eq 0 -and (Test-MostlyBlack $capturePath)) {
          throw 'SCREEN_LOCKED: 屏幕现在锁着或黑着，先解锁再试。'
        }
        $ocrWatch.Stop()
        Write-JsonLine ([ordered]@{
          id = $id
          ok = $true
          engine = 'winrt'
          language = $script:ocrLanguage
          width = $page.width
          height = $page.height
          scale = $plan.upscale
          dpi = $plan.dpi
          origin = [ordered]@{ x = $plan.x; y = $plan.y }
          # 光标在 OCR 图片里的位置：物理偏移 × 放大倍数。
          cursor = [ordered]@{ x = $plan.cursorX * $plan.upscale; y = $plan.cursorY * $plan.upscale }
          captureMs = $captureWatch.ElapsedMilliseconds
          ocrMs = $ocrWatch.ElapsedMilliseconds
          lines = [object[]]$page.lines
        })
      } catch {
        $captureWatch.Stop()
        $code = 'CAPTURE_FAILED'
        $message = $_.Exception.Message
        if ($message -like 'NO_ZH_OCR*') { $code = 'NO_ZH_OCR' }
        elseif ($message -like 'OCR_FAILED*') { $code = 'OCR_FAILED' }
        Write-JsonLine ([ordered]@{
          id = $id
          ok = $false
          code = $code
          error = $message
          captureMs = $captureWatch.ElapsedMilliseconds
        })
      } finally {
        Remove-TempFiles
      }
      continue
    }

    if ($command -eq 'ocr-file') {
      $ocrWatch = [System.Diagnostics.Stopwatch]::StartNew()
      try {
        $path = [string]$request.path
        if ([string]::IsNullOrWhiteSpace($path)) { throw 'OCR_FAILED: 没有图片路径' }
        $page = Invoke-OcrFile $path
        $ocrWatch.Stop()
        Write-JsonLine ([ordered]@{
          id = $id
          ok = $true
          engine = 'winrt'
          language = $script:ocrLanguage
          width = $page.width
          height = $page.height
          ocrMs = $ocrWatch.ElapsedMilliseconds
          lines = [object[]]$page.lines
        })
      } catch {
        $ocrWatch.Stop()
        $code = 'OCR_FAILED'
        if ($_.Exception.Message -like 'NO_ZH_OCR*') { $code = 'NO_ZH_OCR' }
        Write-JsonLine ([ordered]@{
          id = $id
          ok = $false
          code = $code
          error = $_.Exception.Message
          ocrMs = $ocrWatch.ElapsedMilliseconds
        })
      }
      continue
    }

    Write-JsonLine ([ordered]@{ id = $id; ok = $false; code = 'UNKNOWN_COMMAND'; error = "不认识的命令: $command" })
  }
} finally {
  Remove-TempFiles
}

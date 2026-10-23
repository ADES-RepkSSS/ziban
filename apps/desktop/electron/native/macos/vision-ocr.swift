// 字伴 macOS OCR 助手（Apple Vision）
// ================================
//
// 这是一个极薄的命令行程序：stdin 每行一个 JSON，stdout 每行一个 JSON。
// 它只做 OCR，不截屏、不联网、不读剪贴板；截屏由 Node 调系统自带 `screencapture`。
// 这样屏幕录制权限只归 Electron/系统，OCR 子进程不需要任何权限。
//
// 输入：
//   {"id":"1","cmd":"ocr-file","path":"/tmp/ziban.png","languages":["zh-Hans","zh-Hant","en-US"]}
//   {"id":"2","cmd":"ping"}
//   {"id":"3","cmd":"quit"}
//
// 输出：
//   {"id":"1","ok":true,"engine":"apple-vision","width":680,"height":360,
//    "ocrMs":120,"lines":[{"text":"验证码","chars":[{"text":"验","bbox":{...}}]}]}
//
// 编译（macOS，需要 Xcode Command Line Tools）：
//   ./build-vision-ocr.sh
// 或发布时在 CI 里分别编译 x86_64 / arm64，再用 lipo 合成 universal 二进制。
//
// 注意：
// - Vision 的 boundingBox 是左下角原点的归一化坐标；这里统一转成
//   左上角原点的像素坐标，和 Windows WinRT、和 core/screen.ts 的约定一致。
// - macOS 11+ 才支持中文识别；更老的系统会返回 VISION_UNSUPPORTED。
// - 调用 boundingBox(for:) 可能抛错；抛错时退化成整行框，核心层会按等分近似，
//   不会崩，只是水平定位粗一点。

import Foundation
import Vision
import ImageIO
import CoreGraphics
import Dispatch
import Darwin

struct BBox: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRChar: Codable {
    let text: String
    let bbox: BBox
}

struct OCRLine: Codable {
    let text: String
    let chars: [OCRChar]
}

struct Request: Codable {
    let id: String?
    let cmd: String?
    let path: String?
    let languages: [String]?
}

struct Response: Codable {
    let id: String
    let ok: Bool
    let engine: String?
    let width: Int
    let height: Int
    let ocrMs: Int
    let lines: [OCRLine]
    let error: String?
}

enum OcrError: Error, CustomStringConvertible {
    case message(String)

    var description: String {
        switch self {
        case .message(let text): return text
        }
    }
}

func emit(_ response: Response) {
    let encoder = JSONEncoder()
    // 中文直接输出，方便 Node / 调试时看；不转 \uXXXX。
    encoder.outputFormatting = []
    guard let data = try? encoder.encode(response) else { return }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0A]))
}

func loadImage(_ path: String) throws -> CGImage {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
        throw OcrError.message("IMAGE_UNREADABLE")
    }
    guard let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw OcrError.message("IMAGE_UNREADABLE")
    }
    return image
}

func pixelBBox(_ box: CGRect, imageWidth: Int, imageHeight: Int) -> BBox {
    // Vision: 原点左下、归一化；core: 原点左上、像素。
    let x = Double(box.minX) * Double(imageWidth)
    let y = (1.0 - Double(box.maxY)) * Double(imageHeight)
    let width = Double(box.width) * Double(imageWidth)
    let height = Double(box.height) * Double(imageHeight)
    return BBox(x: x, y: y, width: width, height: height)
}

func recognize(path: String, languages: [String]) throws -> (width: Int, height: Int, lines: [OCRLine]) {
    if #available(macOS 11.0, *) {
        // 继续
    } else {
        throw OcrError.message("VISION_UNSUPPORTED: 需要 macOS 11 或更新系统")
    }

    let image = try loadImage(path)
    let width = image.width
    let height = image.height
    if width <= 0 || height <= 0 {
        throw OcrError.message("IMAGE_EMPTY")
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // 关闭语言纠错：界面文字经常是短词、按钮、数字，纠错反而会把
    // “验证码”改成别的词。需要英文时仍然能识别，只是不做猜测。
    request.usesLanguageCorrection = false

    let wanted = languages.isEmpty ? ["zh-Hans", "zh-Hant", "en-US"] : languages
    // 先直接用想要的语言；如果系统能列出支持列表，再过滤成系统认识的。
    // 不能因为 supportedRecognitionLanguages() 失败就退回默认的 en-US。
    request.recognitionLanguages = wanted
    if #available(macOS 11.0, *), let supported = try? request.supportedRecognitionLanguages(),
       !supported.isEmpty {
        let filtered = wanted.filter { supported.contains($0) }
        if !filtered.isEmpty {
            request.recognitionLanguages = filtered
        }
    }

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    guard let observations = request.results else {
        return (width, height, [])
    }

    // 从上到下排序，UI 拿到的顺序和屏幕阅读顺序一致。
    let sorted = observations.sorted { $0.boundingBox.midY > $1.boundingBox.midY }
    var lines: [OCRLine] = []

    for observation in sorted {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let text = candidate.string
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { continue }

        var chars: [OCRChar] = []
        var index = text.startIndex
        while index < text.endIndex {
            let next = text.index(after: index)
            let char = String(text[index..<next])
            var box = observation.boundingBox
            if let charBox = try? candidate.boundingBox(for: index..<next) {
                box = charBox.boundingBox
            }
            chars.append(OCRChar(text: char, bbox: pixelBBox(box, imageWidth: width, imageHeight: height)))
            index = next
        }

        lines.append(OCRLine(text: text, chars: chars))
    }

    return (width, height, lines)
}

// 启动时先报告能力，Node 侧据此决定是否显示“安装命令行工具”的引导。
if #available(macOS 11.0, *) {
    let ready = Response(
        id: "ready",
        ok: true,
        engine: "apple-vision",
        width: 0,
        height: 0,
        ocrMs: 0,
        lines: [],
        error: nil
    )
    emit(ready)
} else {
    let ready = Response(
        id: "ready",
        ok: false,
        engine: "apple-vision",
        width: 0,
        height: 0,
        ocrMs: 0,
        lines: [],
        error: "VISION_UNSUPPORTED: 需要 macOS 11 或更新系统"
    )
    emit(ready)
}

while let line = readLine(strippingNewline: true) {
    if line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { continue }

    let started = DispatchTime.now()
    var requestId = ""
    do {
        guard let data = line.data(using: .utf8) else {
            throw OcrError.message("BAD_REQUEST")
        }
        let request = try JSONDecoder().decode(Request.self, from: data)
        requestId = request.id ?? ""

        switch request.cmd {
        case "quit":
            exit(0)
        case "ping":
            emit(Response(
                id: requestId, ok: true, engine: "apple-vision",
                width: 0, height: 0, ocrMs: 0, lines: [], error: nil
            ))
        case "ocr-file":
            guard let path = request.path, !path.isEmpty else {
                throw OcrError.message("NO_PATH")
            }
            let result = try recognize(path: path, languages: request.languages ?? [])
            let elapsed = Int((DispatchTime.now().uptimeNanoseconds - started.uptimeNanoseconds) / 1_000_000)
            emit(Response(
                id: requestId, ok: true, engine: "apple-vision",
                width: result.width, height: result.height, ocrMs: elapsed,
                lines: result.lines, error: nil
            ))
        default:
            throw OcrError.message("UNKNOWN_COMMAND")
        }
    } catch {
        let elapsed = Int((DispatchTime.now().uptimeNanoseconds - started.uptimeNanoseconds) / 1_000_000)
        let message: String
        if let ocrError = error as? OcrError {
            message = ocrError.description
        } else {
            message = error.localizedDescription
        }
        emit(Response(
            id: requestId, ok: false, engine: "apple-vision",
            width: 0, height: 0, ocrMs: elapsed, lines: [],
            error: message
        ))
    }
}

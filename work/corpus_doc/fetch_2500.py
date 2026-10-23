from pathlib import Path
import urllib.request

url = "http://basic.nmg.smartedu.cn/player/data2/2020/11/12/21/2/5EB279DB5BF27AEEE053F1C8A8C0E792/a76c25774cf0ec35d2b385bc4085c754.docx"
out = Path("work/corpus_doc/changyong2500.docx")
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=60) as r:
    data = r.read()
out.write_bytes(data)
print("bytes", len(data), "head", data[:8])

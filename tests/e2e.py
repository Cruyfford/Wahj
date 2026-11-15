"""End-to-end check against a deployed Wahj server:
a headless browser publishes an animated canvas + tone through Cloudflare Realtime SFU,
a second browser watches the stream and must decode video and audio."""
import asyncio, json, os, random, sys, urllib.request
from playwright.async_api import async_playwright

B = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else os.environ["SERVER"].rstrip("/")

def post(path, body, token=None):
    h = {"content-type": "application/json"}
    if token: h["authorization"] = "Bearer " + token
    r = urllib.request.Request(B + path, data=json.dumps(body).encode(), headers=h)
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")

def account(handle):
    r = post("/api/login", {"handle": handle, "password": "wahj-e2e-123"})
    if r.get("token"): return r["token"]
    r = post("/api/register", {"handle": handle, "name": handle, "password": "wahj-e2e-123"})
    return r["token"]

PUBLISH = """async ([token]) => {
  const S = window.Wahj.S; S.token = token;
  const r = await (await fetch('/api/go-live',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({title:'E2E test '+Date.now(),game:'CI',cat:'retro'})})).json();
  if (!r.job) return {error: r};
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; document.body.appendChild(c);
  const g = c.getContext('2d'); let f = 0;
  setInterval(() => { g.fillStyle = `hsl(${f*4%360},80%,50%)`; g.fillRect(0,0,640,360); g.fillStyle='#fff'; g.font='48px sans-serif'; g.fillText('WAHJ '+(f++),40,200); }, 33);
  const v = c.captureStream(30).getVideoTracks()[0];
  const ac = new AudioContext(); const o = ac.createOscillator(); const d = ac.createMediaStreamDestination(); o.connect(d); o.start();
  const pub = new (eval('Pub'))();
  await pub.start([{track: v, role: 'screen'}, {track: d.stream.getAudioTracks()[0], role: 'audio'}], r.job);
  window.__pub = pub;
  return {room: r.job.room, sid: pub.sid};
}"""

STATS = """async () => {
  const st = document.querySelector('#ws'); 
  const s = window.__stage || null;
  const vids = [...document.querySelectorAll('#ws video')].map(v => ({w: v.videoWidth, h: v.videoHeight, t: v.currentTime}));
  return vids;
}"""

async def main():
    host = account("wahje2ehost")
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"])
        a = await (await br.new_context()).new_page()
        logs = []
        a.on("console", lambda m: logs.append("A " + m.text))
        await a.goto(B + "/"); await a.wait_for_timeout(1500)
        res = await a.evaluate(PUBLISH, [host])
        print("publish:", res)
        if "error" in res: raise SystemExit("publish failed")
        room = res["room"]
        st = json.load(urllib.request.urlopen(B + f"/api/room/{room}/state"))
        print("room state publishers:", len(st["publishers"]))
        assert st["publishers"], "no publishers registered"
        b = await (await br.new_context()).new_page()
        b.on("console", lambda m: logs.append("B " + m.text))
        await b.add_init_script("localStorage.setItem('wahj.guest','true')")
        await b.goto(B + "/w/" + room)
        ok = False
        for i in range(30):
            await b.wait_for_timeout(1000)
            v = await b.evaluate(STATS)
            print(i, v)
            if v and v[0]["w"] > 0 and v[0]["t"] > 1:
                ok = True; break
        lat = await b.evaluate("document.querySelector('#wlat span') && document.querySelector('#wlat span').textContent")
        print("latency badge:", lat)
        audio = await b.evaluate("[...document.querySelectorAll('#ws audio')].map(a=>!!a.srcObject && a.srcObject.getAudioTracks().length)")
        print("audio elements:", audio)
        await b.screenshot(path="e2e-viewer.png")
        await a.evaluate("window.__pub && window.__pub.stop()")
        post("/api/end", {"room": room}, host)
        for l in logs[-30:]: print(l)
        await br.close()
        if not ok: raise SystemExit("viewer never received video")
        print("E2E OK")

asyncio.run(main())

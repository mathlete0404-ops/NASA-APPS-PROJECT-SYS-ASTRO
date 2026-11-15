"""Capture real Crew Mirror screens for the ad (ad capture only, never shipped).

Runs the live dev app (npm run dev in web/, http://localhost:5173) in Playwright at
402x856 CSS px, device scale 2, dark mode. Each capture gets its own browser context
with a 21-day history for one astronaut written straight into IndexedDB (fixture.js).
Interactions are scripted with the real UI; CSS animations and transitions are stepped
frame by frame (33.3 ms) so every clip is smooth at 30 fps.

Outputs
  ad/clips/<name>.mp4   H.264 clips, 804x1712, 30 fps (played inside the phone)
  ad/shots/<name>.webp  stills of the real app
  ad/clips/meta.js      window.CAPTURE = {...} rects and cursor paths in CSS px

Usage (from the scratchpad folder that has the adenv venv):
  adenv/bin/python -I /Users/.../crew-mirror/ad/capture/capture.py [names...]
"""
import io, json, os, subprocess, sys
import imageio_ffmpeg
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # ad/
APP = 'http://localhost:5173'
FIX = open(os.path.join(ROOT, 'capture', 'fixture.js')).read()
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
W, H, DSF = 402, 856, 2
META_PATH = os.path.join(ROOT, 'clips', 'meta.json')
os.makedirs(os.path.join(ROOT, 'clips'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'shots'), exist_ok=True)
meta = json.load(open(META_PATH)) if os.path.exists(META_PATH) else {}

# Step every Web Animation (CSS animations + transitions) by a fixed time per frame.
TICK = """(dt) => { for (const a of document.getAnimations()) {
  if (!a.__cap) { a.__cap = 1; a.pause() } else { a.pause(); a.currentTime = (a.currentTime || 0) + dt } } }"""
NOSCROLLBAR = "html{scroll-behavior:auto!important} ::-webkit-scrollbar{display:none} *{caret-color:transparent!important}"


class Clip:
    def __init__(self, name):
        self.name, self.n, self.cursor = name, 0, []
        out = os.path.join(ROOT, 'clips', name + '.mp4')
        self.ff = subprocess.Popen([FFMPEG, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-',
                                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-g', '6',
                                    '-movflags', '+faststart', out], stdin=subprocess.PIPE)

    def frame(self, pg, settle=60):
        pg.wait_for_timeout(settle)
        pg.evaluate(TICK, 1000 / 30)
        self.ff.stdin.write(pg.screenshot(type='png'))
        self.n += 1

    def close(self, **extra):
        self.ff.stdin.close(); self.ff.wait()
        meta[self.name] = {'frames': self.n, 'cursor': self.cursor, **extra}
        print(self.name, self.n, 'frames', flush=True)


def session(p, opts=None, tab='today', perms=False):
    b = p.chromium.launch(headless=True, channel='chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DSF, color_scheme='dark', is_mobile=True,
                        locale='en-US', timezone_id='Asia/Seoul')
    if perms:
        ctx.grant_permissions(['notifications'], origin=APP)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: print('pageerror', e))
    pg.goto(APP + '/manifest.webmanifest')
    pg.evaluate(FIX, opts or {})
    pg.goto(f'{APP}/#/app/{tab}')
    pg.wait_for_load_state('networkidle')
    pg.add_style_tag(content=NOSCROLLBAR)
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(1200)
    return b, pg


def rect(pg, sel):
    return pg.evaluate("(s) => { const r = document.querySelector(s).getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height} }", sel)


def scroll_to(pg, y):
    pg.evaluate(f'window.scrollTo(0, {y})')


def ease(a):
    return a * a * (3 - 2 * a)


def still(pg, name, q=92):
    png = pg.screenshot(type='png')
    Image.open(io.BytesIO(png)).convert('RGB').save(os.path.join(ROOT, 'shots', name + '.webp'), quality=q, method=6)


def click_at(pg, clip, x, y):
    clip.cursor.append({'f': clip.n, 'x': x, 'y': y, 'click': True})
    pg.mouse.click(x, y)
    pg.mouse.move(2, 2)  # no hover state left behind after the tap


def center(pg, locator):
    bb = locator.bounding_box()
    return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2


# ------------------------------------------------------------------ captures
def cap_today(p):
    """Stills: Today top (for the opening tap) and the 'How you're doing' banner, closed and open."""
    b, pg = session(p)
    still(pg, 'today_top')
    btn = pg.get_by_role('button', name='Start today’s check · 2 min')
    meta['today_top'] = {'start': dict(zip(('x', 'y'), center(pg, btn)))}
    banner_y = pg.evaluate("document.querySelector('.banner').getBoundingClientRect().top + scrollY")
    scroll_to(pg, banner_y - 140); pg.wait_for_timeout(200)
    still(pg, 'today_banner')
    summ = pg.locator('.banner details.why-details summary').first
    meta['today_banner'] = {'how': dict(zip(('x', 'y'), center(pg, summ)))}
    summ.click(); pg.wait_for_timeout(300)
    still(pg, 'today_banner_open')
    b.close()


def cap_today_scroll(p):
    b, pg = session(p)
    c = Clip('m_today')
    end = 1250
    for i in range(45):
        a = min(1, i / 40)
        scroll_to(pg, round(end * ease(a)))
        c.frame(pg, 20)
    c.close()
    b.close()


def cap_plan_tick(p):
    b, pg = session(p, tab='plan')
    y = pg.evaluate("[...document.querySelectorAll('.card h3')].find(h => h.textContent === 'Exercise').getBoundingClientRect().top + scrollY")
    scroll_to(pg, y - 110); pg.wait_for_timeout(300)
    c = Clip('m_plan')
    dot = pg.locator('.check-dot').first
    x, yy = center(pg, dot)
    for i in range(42):
        if i == 12:
            c.cursor.append({'f': c.n, 'x': x, 'y': yy, 'click': True})
            pg.evaluate("""async () => { const url = performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('/src/data/store.ts')) || '/src/data/store.ts'; const st = await import(url);
              const d = new Date(); d.setHours(9, 5, 0, 0);
              st.addWorkout({ id: 'ms3-wo-squat-now', crewId: 'MS3', ts: d.toISOString(), exercise: 'squat', reps: 10, formScore: 100, faults: {}, bestAngle: 97, source: 'coach' }) }""")
            pg.wait_for_timeout(150)
        c.frame(pg, 20)
    c.close(dot={'x': x, 'y': yy})
    b.close()


def cap_food(p):
    b, pg = session(p, tab='plan')
    y = pg.evaluate("[...document.querySelectorAll('.card h3')].find(h => h.textContent === 'Food today').getBoundingClientRect().top + scrollY")
    scroll_to(pg, y - 90); pg.wait_for_timeout(300)
    c = Clip('m_food')
    for i in range(45):
        if i in (6, 18, 30):
            ideas = pg.locator('.idea button')
            add = ideas.first if ideas.count() else pg.get_by_role('button', name='Add').first
            x, yy = center(pg, add)
            if yy < 840:
                click_at(pg, c, x, yy)
            else:
                add.click()
            pg.wait_for_timeout(120)
            scroll_to(pg, y - 90)
        c.frame(pg, 20)
    c.close()
    b.close()


def cap_body(p):
    b, pg = session(p, tab='body')
    pg.wait_for_timeout(6000)
    pg.get_by_role('button', name='Muscles', exact=True).click()
    pg.wait_for_timeout(9000)
    cv = pg.locator('canvas').first
    bb = cv.bounding_box()
    cx, cy = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] * 0.55
    c = Clip('m_body')
    pg.mouse.move(cx + 60, cy)
    for i in range(45):
        if i == 3:
            pg.mouse.down()
        if 3 <= i <= 36:
            pg.mouse.move(cx + 60 - (i - 3) * 9, cy + (i - 3) * 0.4, steps=2)
            c.cursor.append({'f': c.n, 'x': cx + 60 - (i - 3) * 9, 'y': cy + (i - 3) * 0.4, 'drag': True})
        if i == 37:
            pg.mouse.up()
        c.frame(pg, 120)
    c.close()
    b.close()


def cap_space(p):
    b, pg = session(p)
    pg.wait_for_timeout(1500)  # live NOAA reading saved by the card
    c = Clip('m_space')
    pill = pg.locator('.sw-pill')
    x, yy = center(pg, pill)
    target = pg.evaluate("document.getElementById('space-weather').getBoundingClientRect().top + scrollY - 72")
    for i in range(45):
        if i == 7:
            click_at(pg, c, x, yy)
            pg.wait_for_timeout(30)
            scroll_to(pg, 0)
        if i > 8:
            a = min(1, (i - 8) / 26)
            scroll_to(pg, round(target * ease(a)))
        c.frame(pg, 20)
    c.close()
    b.close()


def cap_calendar(p):
    b, pg = session(p, tab='calendar')
    c = Clip('m_calendar')
    day = pg.locator('.cal button.day:not(.out)').nth(17)
    for i in range(40):
        if i == 10:
            x, yy = center(pg, day)
            click_at(pg, c, x, yy)
            pg.wait_for_timeout(150)
        if i > 22:
            scroll_to(pg, round(150 * ease(min(1, (i - 22) / 14))))
        c.frame(pg, 20)
    c.close()
    b.close()


def cap_report(p):
    b, pg = session(p, tab='report')
    c = Clip('m_report')
    down = 0
    for i in range(50):
        if i == 6:
            yes = pg.get_by_role('button', name='Yes').first
            x, yy = center(pg, yes)
            click_at(pg, c, x, yy)
            pg.wait_for_timeout(150)
            btn_y = pg.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Act now')).getBoundingClientRect().bottom + scrollY")
            down = max(0, btn_y - 760)
        if 9 <= i <= 19:
            scroll_to(pg, round(down * ease((i - 9) / 10)))
        if i == 22:
            btn = pg.get_by_role('button', name='Continue → Act now')
            x, yy = center(pg, btn)
            click_at(pg, c, x, yy)
            pg.wait_for_timeout(300)
            scroll_to(pg, 0)
        c.frame(pg, 20)
    c.close()
    b.close()


def cap_reminders(p):
    b, pg = session(p, {'reminders': {'enabled': False, 'time': '07:30', 'nudge': True}}, tab='settings', perms=True)
    y = pg.evaluate("[...document.querySelectorAll('h3, h2')].find(h => h.textContent === 'Reminders').getBoundingClientRect().top + scrollY")
    scroll_to(pg, y - 100); pg.wait_for_timeout(300)
    c = Clip('m_reminders')
    sw = pg.locator('input.switch').first
    for i in range(42):
        if i == 9:
            x, yy = center(pg, sw)
            click_at(pg, c, x, yy)
            pg.wait_for_timeout(300)
            scroll_to(pg, y - 100)
        c.frame(pg, 20)
    c.close()
    b.close()


def cap_check(p):
    """Daily check while scanning: the stage is cleared (the ad draws the face mesh there),
    the idle hint is hidden and the overlay shows the real scanning text."""
    b, pg = session(p, tab='check')
    pg.evaluate("""() => {
      document.querySelector('.stage-idle')?.remove()
      document.querySelector('.stage .overlay').textContent = 'Hold still and breathe normally.'
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Start scan'); if (btn) btn.disabled = true }""")
    pg.wait_for_timeout(200)
    still(pg, 'check_scan')
    st = rect(pg, '.stage')
    ov = rect(pg, '.stage .overlay')
    # the overlay alone, so the ad can draw the mesh underneath it
    pg.evaluate("() => { const s = document.querySelector('.stage'); s.style.background = 'transparent'; s.querySelector('canvas').style.visibility = 'hidden' }")
    pg.locator('.stage .overlay').screenshot(path=os.path.join(ROOT, 'shots', 'check_overlay.png'), omit_background=True)
    meta['check'] = {'stage': st, 'overlay': ov}
    b.close()


def cap_pet(p):
    """Today's pet card at egg (0 check days), hatchling (1) and cadet (7)."""
    out = {}
    for name, opts in (('egg', {'checkDays': 0, 'reminders': None}), ('hatchling', {'checkDays': 0, 'today': True, 'reminders': None}),
                       ('cadet', {'checkDays': 6, 'today': True, 'reminders': None})):
        b, pg = session(p, opts)
        y = pg.evaluate("document.querySelector('.pet-card').getBoundingClientRect().top + scrollY")
        scroll_to(pg, y - 70); pg.wait_for_timeout(300)
        pg.evaluate("document.getAnimations().forEach(a => { a.pause(); if (String(a.animationName).startsWith('pet-')) a.currentTime = 0; else try { a.finish() } catch (e) {} })")
        svg = rect(pg, '.pet-stage-wrap svg')
        pg.locator('.pet-stage-wrap').screenshot(path=os.path.join(ROOT, 'shots', f'pet_{name}_wrap.png'))
        pg.add_style_tag(content='.pet-stage-wrap svg{visibility:hidden}')
        pg.wait_for_timeout(100)
        still(pg, f'pet_{name}_bg')
        pg.add_style_tag(content='.pet-stage-wrap svg{visibility:visible} .pet-stage-wrap{background:transparent!important} body,html,.card,.pet-card{background:transparent!important}')
        pg.wait_for_timeout(100)
        pg.locator('.pet-stage-wrap svg').screenshot(path=os.path.join(ROOT, 'shots', f'pet_{name}.png'), omit_background=True)
        out[name] = {'svg': svg, 'wrap': rect(pg, '.pet-stage-wrap')}
        b.close()
    meta['pet'] = out


ALL = {'today': cap_today, 'm_today': cap_today_scroll, 'm_plan': cap_plan_tick, 'm_food': cap_food, 'm_body': cap_body,
       'm_space': cap_space, 'm_calendar': cap_calendar, 'm_report': cap_report, 'm_reminders': cap_reminders,
       'check': cap_check, 'pet': cap_pet}

if __name__ == '__main__':
    names = sys.argv[1:] or list(ALL)
    with sync_playwright() as p:
        for n in names:
            ALL[n](p)
    json.dump(meta, open(META_PATH, 'w'), indent=1)
    with open(os.path.join(ROOT, 'clips', 'meta.js'), 'w') as f:
        f.write('// Generated by ad/capture/capture.py: rects and cursor paths (CSS px) of the real app captures.\n')
        f.write('window.CAPTURE = ' + json.dumps(meta) + '\n')
    print('ok')

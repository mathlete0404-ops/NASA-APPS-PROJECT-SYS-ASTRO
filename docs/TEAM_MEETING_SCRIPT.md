# Crew Mirror: word-for-word team meeting script (Building stage)

Team SYS-ASTRO · NASA Space Apps Seoul 2026
**M** = Matthew (shares screen) · **T** = Teammate
Words in [brackets] are actions. Don't read them out. Everything else is read word for word.
Timing: read at a normal pace, the full script takes about 18 minutes, which is longer than the 10–15 minute meeting. Skipping the parts marked ⏩ brings it to about 15 minutes. For a 10-minute version, also shorten sections 9 and 10 to two or three lines each.

**Before joining:** run `npm run dev` in `web/`, open http://localhost:5173 in a private window so the first-open setup appears, and keep a second tab with the sample crew already loaded.

---

## 1. Opening

**M:** Hi, we're Team SYS-ASTRO. I'm Matthew, and I'll share my screen.

**T:** Hi, I'm [name]. I'm on the team with Matthew.

**M:** We chose the challenge "Create Health Monitoring Software for Astronauts on Space Missions." Our project is called Crew Mirror. It's a two-minute daily health check that uses only the camera on a laptop or tablet. It shows how your body is changing, explains why, and tells you what to do today, without needing Earth.

---

## 2. Who it's for and why it matters

**M:** Our user is an astronaut on a long mission, for example a trip to Mars. On that trip, a message to Earth can take up to about twenty minutes each way. There is often no doctor on board, and the crew is busy and tired.

**M:** And in space, the body changes every day. Weight-bearing bones lose about one percent a month. Muscles get smaller. Fluid moves up into the head, so the face gets puffy. Sleep gets worse. After landing, the brain has to learn balance again. If nobody notices these changes early, they become real problems.

**M:** So the question we asked was: how can an astronaut notice that their body is changing, and know what to do today, without calling Earth?

**T:** And because there is no reliable internet in space, we made one rule from the very beginning: the app has to work offline. That rule shaped almost every technical decision we made.

---

## 3. Our own approach: compare you with you

**M:** [Open the Evidence tab.] Most health apps compare you with an average person. We think that is the wrong question in space, and we checked it with NASA data.

**M:** We used NASA's Open Science Data Repository, studies OSD-569 and OSD-575. These are the blood tests of the four Inspiration4 astronauts. We looked at 137 blood values from the day after landing. We compared each value with two things: the normal range for the general population, and that astronaut's own range before the flight.

**M:** The population range flagged only five values. But fifty-five values had moved outside the astronaut's own normal range, and the population range still called every one of them normal.

**M:** That is why Crew Mirror compares each astronaut with themselves, not with an average person.

**T:** Here is how that works. The first seven days of checks become your baseline, your personal normal. After that, every new value is compared with the middle value of your own history. We use the middle value, not the average, so one strange day doesn't change your normal.

**T:** If a value is clearly different from your normal, the status is "Watch." If it is very different, or if it stays on Watch for three days in a row, it becomes "Act." And if the measurement is bad, for example the light is too dark or you moved too much, the app says "No data." It never says "Fine" when it doesn't actually know.

---

## 4. First open: setting up

**M:** [Switch to the private window showing the setup screen.] This is what a new astronaut sees the first time they open the app. No account or internet is needed.

**M:** [Click "Set up my profile".] You enter a call sign, not your real name, then your role, and which phase of the mission you're in: before launch, in flight, just landed, on the Moon or Mars, or back on Earth. The app changes what it shows depending on the phase. For example, balance tests are switched off while you're floating, because there is no "up" or "down."

**M:** [Click Continue.] Next, it explains the four statuses in plain words. [Click Continue.] And then you start your first check.

**M:** We built this because, honestly, our first version was confusing even for us. So we added a guided start and a "How to use" button that is always in the sidebar.

---

## 5. Today screen

**M:** [Switch to the sample crew tab and open Today.] This is the home screen, shown here with a sample crew. Every person and number in the sample crew is made up, and the yellow bar at the top says so.

**M:** At the top, one sentence tells you how you are doing in plain words, like "You slept less than usual." Below it, one button starts today's check. If you want the numbers, you can open "How we know" to see the statistics.

**M:** Under that, the last seven days are shown as colored dots, so you can see a pattern at a glance.

---

## 6. Daily check

**M:** [Open Daily check.] This is the daily check. It takes about two minutes.

**M:** [Click "Start scan" if the camera works.] First, a short face scan. From the camera, the app estimates your heart rate from tiny color changes in your skin that happen with each heartbeat. It estimates your breathing rate from small movements of your head. It counts how often you blink and how long your eyes stay closed, which are signs of tiredness. And it measures the width of your face compared with the distance between your eyes, to spot fluid moving to the head.

**M:** Then a few quick questions: your mood, your energy, how many hours you slept, and how well you slept.

**M:** For the camera, we use Google's MediaPipe. It finds hundreds of points on your face and body, right in the browser. We run it in a background worker, so the screen doesn't freeze while it works.

**M:** The most important part is privacy. Only the dots are drawn on screen. The video itself is never shown, never saved, and never sent anywhere. We only save the numbers.

**T:** And if the light is bad, or your face moves out of the frame, that measurement becomes "No data" for the day. We would rather say "we don't know" than give a wrong answer.

---

## 7. Plan: exercise and food

**M:** [Open Plan.] The Plan turns your results into a to-do list for today, and every item says why it is there.

**M:** For example, if your sleep is lower than your normal, it suggests what to change tonight. If your face is fuller than usual, it says to check your fluids and the carbon dioxide level in the module.

**M:** There is an exercise checklist that changes with the mission phase. In flight, it lists the resistance machine and treadmill sessions astronauts actually do. On the Moon or Mars, it adds walking, because partial gravity still helps your bones.

**M:** [Scroll to Food.] There is also a food log. You add what you ate, and it tracks calories, protein, calcium, vitamin D, fluid and salt against your targets. There are quick buttons for water and vitamin D. We added this because astronauts usually eat less than they need in space, and that speeds up muscle and bone loss.

---

## 8. Calendar ⏩

**M:** [Open Calendar.] The Calendar shows the whole mission day by day. Each day is colored by that day's status. You can also add mission events, like a spacewalk, landing day, or a medical conference, and see pain reports, workouts and balance tests on the day they happened.

---

## 9. Report pain

**M:** [Open Report pain.] This is what you use when something hurts.

**M:** The first step is always the danger signs: chest pain; sudden weakness or numbness on one side, a drooping face or slurred speech; a sudden, severe headache or a change in vision; back pain with numb legs or bladder problems; and pain after a fall or a hit. [Click "Yes" on one.] If you answer yes to any of these, the app says "Act now, contact the crew medical officer," and it gives no exercises.

**M:** These are fixed rules, not artificial intelligence. We chose that on purpose. A safety decision has to be explainable, so every result shows the reasons behind it, and we can test every rule.

**M:** [Answer "No" to all of them and continue.] If everything is "no," you show where it hurts. There are three ways: tap it on the 3D body, point to it with your finger in front of the camera, or choose it on a simple body map.

**M:** Then the app asks you to do a few simple tests. Press on the spot. Move the joint. Push against resistance. Stretch it. Each answer helps tell the difference between a muscle, a joint, a bone or a nerve problem.

**M:** Next is "Find the source." Pain is often felt away from where it starts. For example, a pinched nerve in the lower back can hurt in the leg, and a hip problem can hurt in the knee. So the app asks a few more questions and lights up the likely sources on the 3D body.

**M:** At the end, you get a result. It always says "pattern," never "diagnosis." If it could be a broken bone or a nerve problem, it sends you to the crew medical officer. If it looks like a simple muscle strain, it gives safe exercises and tells you to check again in forty-eight hours.

**T:** One more safety detail: the app also knows that bones get weaker in space. So the longer you have been weightless, the more seriously it treats pain in a bone.

---

## 10. 3D body

**M:** [Open 3D body.] This is the 3D body. I'm especially proud of this part.

**M:** [Rotate and zoom.] I took an open-source anatomy model called Z-Anatomy and wrote a script for Blender, the 3D software, that splits it into one thousand five hundred and eighteen separate structures you can click, down to small bones and muscles. [Click a small muscle.] Each one has its name and region.

**M:** [Switch between Body, Muscles, Bones, Nerves.] You can switch between the skin, the muscles, the bones and the nerves, or turn on X-ray mode to see through the layers. You can also search for any structure by name.

**M:** To keep it fast, the model is compressed to about six megabytes, and it only loads when you open this tab.

**M:** We also made the body sex-neutral on purpose, so it works for every crew member.

**M:** If a measurement is on "Watch" or "Act," the matching part of the body is highlighted, so you can see where the problem is.

---

## 11. Exercise coach ⏩

**M:** [Open Exercise coach.] The exercise coach uses the camera to watch your body while you exercise. It supports squats, lunges, arm raises, calf raises, and sit-to-stand.

**M:** It counts your repetitions, measures the angle of your knee or shoulder, and gives you tips on your form while you move.

**M:** Before and after each set, it asks how much it hurts, from zero to ten. If the pain goes up by two points or more, it tells you to stop and report the pain.

**M:** You can also export the 3D joint positions, with no video, to look at them later in Blender or a spreadsheet.

---

## 12. Balance ⏩

**M:** [Open Balance.] Balance tests use the camera too. There are four: standing with feet together and eyes open, the same with eyes closed, standing heel to toe, and standing up from a chair five times as fast as you can.

**M:** The app measures how much your hips sway, compared with the width of your shoulders, so it doesn't matter how far you stand from the camera.

**M:** After landing, it answers one question: "Is it safe to walk, or to go on a spacewalk?" NASA tests balance before flight and right after landing, and we do the same. While you are floating, these tests are turned off, because there is no up or down.

---

## 13. Trends ⏩

**M:** [Open Trends.] Trends shows every measurement over time as a small chart, with your normal range shaded, so you can see a slow change that you wouldn't notice from one day to the next.

---

## 14. Teammate: radiation, offline, sign-in and the medical officer

**T:** Now I'll explain the parts I built.

**T:** [Matthew opens Today and scrolls to the solar radiation storm card.] First, the solar radiation storm card. Radiation is one of the biggest risks on a long mission. A solar storm can raise the dose very quickly, and the crew needs to know when to take shelter.

**T:** This card reads live proton data from NOAA's space weather service and converts it into the official storm scale, from S1, minor, to S5, extreme. It shows a simple status, like "Quiet." I wrote tests for every level of the scale.

**T:** But in space there is no reliable internet. So when there is no connection, the card shows the last saved reading, labeled "Last known," instead of breaking or showing a wrong number. And it is only context. The spacecraft's own radiation sensors and the mission rules always come first.

**T:** [Matthew opens Evidence and scrolls to "Radiation & bone in space."] On the Evidence page, we also show typical radiation levels and how much bone an astronaut may lose for the time they have been weightless, so the numbers make sense.

**T:** Second, I worked on making the whole app offline-first. I fixed the offline cache, so when the network disappears the app still opens instead of showing broken pages. It can also be installed like a normal app on a laptop or tablet.

**T:** Third, sign-in and switching between crew members. Everything is saved on the device first. When a connection is available, it syncs to the cloud. If not, nothing is lost. Each astronaut can only see their own records, and the database itself enforces that, not just the app.

**T:** [Matthew opens Medical officer.] This is the crew medical officer view. The medical officer sees the status of everyone in the crew on one screen, with alerts at the top. They can also write a message to the flight surgeon on Earth. It goes into a downlink queue and is sent when the next connection opens. Only numbers are sent, never images or video.

**T:** We also have a small server that stands in for the spacecraft's own computer. The app works without it, but when it is connected, the numbers are shared with it.

**T:** Last, I set up automatic testing and publishing. Every time we push code to GitHub, the same safety-rule tests run in both the web app and the Python server, and then the site is published automatically. We are a small team moving fast, so this makes sure a new feature never quietly breaks a safety rule.

---

## 15. Settings ⏩

**M:** [Open Settings.] In Settings, you can change your profile, your mission phase, your nutrition targets, light or dark mode, and your cloud account. You can also export all your data as a file, and there is a privacy section that explains exactly what is stored and what is not.

---

## 16. How we built it

**M:** To sum up how we built it: the app is made with React and TypeScript and runs in any browser. The camera tracking uses MediaPipe on the device. The 3D body uses three.js and the Z-Anatomy model, prepared in Blender. The habitat server is Python with FastAPI and SQLite. The cloud sync uses Supabase.

**M:** For NASA data, we used the Open Science Data Repository studies OSD-569 and OSD-575, the RadLab portal for radiation context, and the data.nasa.gov catalog. Every card in the app shows its source.

**M:** I built this with Claude Code as a coding assistant. Following the event rules, we record every AI-assisted change in our AI-use log. The ideas, the design decisions and the testing were ours.

---

## 17. What each of us did, and what's next

**M:** What I worked on: the front end, the screens you saw, the camera features, the 3D body, the plan, and the exercise coach. What's next for me: today I'm finishing the design, with one consistent style on every screen and clearer wording. I've already run an automatic browser test across all twelve screens and fixed what it found. Then I'll record the demo video and write our project description.

**T:** What I worked on: the solar radiation storm card, the offline cache, sign-in and sync, and automatic testing and publishing. What's next for me: I'll test sign-in and sync from start to finish, make sure the published site matches our latest code, and finish the credits for every NASA dataset and library we used.

**M:** To be honest about what isn't finished: the camera measurements are estimates. We tested them on test signals, not on real astronauts. The food values are approximate. And it is a prototype, not a medical device. We list all of these limits in our README.

**M:** That's everything we have built so far. Thank you for listening, and we'd be happy to answer any questions.

---

## If mentors ask

**"How is this different from other teams?"**
**M:** We compare each astronaut with their own normal, not with an average person. NASA's Inspiration4 data shows why: the population range missed most of the changes. We also explain why the body is changing and give one clear next step.

**"How does it work without internet?"**
**T:** The camera tracking runs in the browser. Data is saved on the device first. The habitat server stands in for the spacecraft computer, cloud sync is optional, and the radiation card shows the last known reading.

**"Why not use AI for the safety decisions?"**
**M:** Safety decisions have to be explainable and testable. Fixed rules always show their reasons, and danger signs always go to a person: the crew medical officer.

**"Is the camera heart rate accurate?"**
**M:** It's an estimate, and we label it that way. If the signal is poor, we show "No data" instead of a number. It's a prototype, not a medical device.

**"Who can see an astronaut's data?"**
**T:** Each astronaut sees only their own records. The medical officer sees only their own mission. The database enforces this, not just the app.

**"Which NASA data did you use?"**
**M:** OSDR studies OSD-569 and OSD-575 for the personal baseline evidence, the RadLab portal for radiation context, and the data.nasa.gov catalog. Every card shows its source.

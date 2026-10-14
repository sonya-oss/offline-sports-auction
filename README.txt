OFFLINE SPORTS AUCTION — GLOBAL MULTIPLAYER PROTOTYPE
====================================================

This is a browser-based sports auction prototype. Despite the project name,
global live multiplayer requires internet access and a publicly hosted server.
The interface works on phones, tablets, and computers in a modern browser.

FEATURES
--------
- Name-only participation (no email, Google sign-in, password, or phone number)
- Fresh random participant/team IDs when joining/creating a room
- Create rooms with Cricket, Kabaddi, Football, or Custom sports
- Sport-specific player roles, player list, base prices, budget and bid increments
- Shareable room code, teams, live polling updates, bidding, sold/unsold results
- Responsive browser interface

RUN LOCALLY FOR TESTING
-----------------------
1. Install Python 3.11 or newer.
2. Extract this folder.
3. Run run_windows.bat, or use:
     py -m pip install -r requirements.txt
     py server.py
4. Open http://127.0.0.1:5000

Local testing on the same Wi-Fi is possible using the host computer's LAN IP.
For friends anywhere in the world, deploy the service publicly first.

DEPLOY ONLINE USING RENDER (prototype hosting)
-----------------------------------------------
1. Create a GitHub account if you do not already have one.
2. Upload the contents of this folder to a new GitHub repository.
3. Sign in to Render and create a new Blueprint using that repository.
4. Render reads render.yaml, installs requirements, and starts Gunicorn.
5. Once deployed, open the HTTPS URL Render gives you. Share that URL and the
   room code with friends. They can join from any place with internet access.

IMPORTANT PROTOTYPE LIMITATIONS
-------------------------------
- Room state is stored in server memory. Rooms are lost if the service restarts,
  redeploys, or sleeps. Do not use this prototype for important tournaments.
- Use a single Gunicorn worker because the current room state is in memory.
- Name-only registration is anonymous, not identity verification. Names can be
  duplicated, and a participant's random ID is the actual temporary identity.
- The app does not persist user profiles. Uninstalling a browser shortcut/app is
  not a server-side deletion event; room/session data expires when the server
  process resets. This version does not keep a permanent user account database.
- This is an early prototype, not a security-audited public service. Anyone with
  a room code may try to join; share codes only with intended participants.
- Before a public launch, add rate limits, stronger host authorization, durable
  storage/expiry rules, and tests for reconnects and simultaneous bids.

AUCTION FLOW
------------
1. Host creates a room and sets sport, budget and minimum increment.
2. Host adds players with roles and base prices.
3. Host adds their team; friends enter room code, name and team name.
4. Host starts the auction. Participants press Bid; host closes each player.
5. The host advances through players; final team rosters and budgets are shown.

HEALTH CHECK
------------
The /health endpoint returns a simple service status for hosting platforms.

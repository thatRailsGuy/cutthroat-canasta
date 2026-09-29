# Cutthroat Canasta: Playtest Setup

## Purpose

This playtest checks what no automated test can: how the web client looks and behaves in real browsers and on phones. Run it before `feat-web-client` is merged to `main`.

Already covered by automation, so no need to retest in depth: 224 engine, 97 server and 78 web tests, plus a scripted two-player WebSocket run (start, hidden hands, draw, discard, feed, reissue and rejoin, a refused stale token, ping). Nobody has yet looked at the layout, the phone view, the rules drawer or print preview.

## Prerequisites

| Item | Requirement |
| --- | --- |
| Host machine | The Mac with the repo at `~/projects/experiments/cutthroat-canasta` |
| Node | 24.10 or later (`node -v`) |
| Branch | `feat-web-client` |
| Browsers | One browser profile per player, plus one fresh profile for rejoin-link tests |
| Players | At least 2; a third makes presence and reissue checks easier |
| Phones (optional) | On the same Wi-Fi as the host machine |

Each player must use a separate browser profile or a separate browser. The seat token is stored per profile, so two tabs in one profile are the same player.

## Setup

1. Check out the branch and install the exact locked dependencies:
    ```sh
    cd ~/projects/experiments/cutthroat-canasta
    git checkout feat-web-client
    npm ci
    ```
    Use `npm ci`, not `npm install`. An incremental install strips native bindings from the lockfile.
2. Optional sanity check: `npm test` should report 224, 97 and 78 passing tests.
3. In terminal 1, start the game server (wrangler dev on port 8787):
    ```sh
    npm run dev:server
    ```
4. In terminal 2, start the web client (Vite on port 5173):
    ```sh
    npm run dev:web
    ```
    Proxy `ECONNREFUSED` lines before wrangler is ready are expected.
5. Open `http://localhost:5173` in each player's browser profile.
6. For phone-layout checks on the desktop, set one window to 375 px wide with the devtools device toolbar.

## Playing from phones

Vite listens only on localhost by default. To reach it from phones on the same Wi-Fi, start the web client with `--host` instead of step 4:

```sh
npm run dev -w @canasta/web -- --host
```

1. Vite prints a Network address, such as `http://192.168.1.20:5173`. Open that address on each phone.
2. Leave the server as in step 3. Vite forwards `/api` to wrangler on the host machine, so wrangler stays local.
3. If a phone can't connect, allow incoming connections for Node in the macOS firewall.

Over plain http, phones have no Clipboard API. **Copy** on a rejoin link says "Select and copy" and selects the text instead. That is expected.

## Test script

The players are Ann (the host), Bob, and a fresh profile for rejoin links. Tick each item as it passes.

### Lobby

- [ ] Ann enters a name and presses **Create a game**. The lobby shows the code and a share link.
- [ ] Bob joins with the code. Both see both seats with green dots. Only Ann sees **Kick** and **Start game**.
- [ ] Bob presses **Leave** and sees "You left the game." He joins again. Ann kicks him, and he sees "The host removed you from the game."
- [ ] Ann, alone, presses **Start game**. A toast says "You need at least 2 players to start." Its **Why?** opens the rules drawer.
- [ ] `/g/QQQQQQ` shows "There's no game with the code QQQQQQ." with a link home.
- [ ] Reloading Ann's tab puts her back in her seat, without the join form and without a second join.

### Table

- [ ] Draw from the stock. Pick up the pile with a natural pair: select the top discard and two matching cards, then **Pick up pile**.
- [ ] Meld, add to a meld by clicking it, then discard.
- [ ] An illegal play (for example, 3 naturals under the initial minimum) shows the engine's message and a **Why?** link. **Meld** stays disabled.
- [ ] Out of turn, the action buttons are disabled.
- [ ] The feed shows the newest events first. The **Frozen for you** badge shows its reason.
- [ ] Meld labels read "Aces" and "Kings", in rank order.
- [ ] At 375 px, the table is one column with no sideways scrolling.

### Presence and rejoin

- [ ] Close Bob's tab. Ann sees his dot go grey.
- [ ] Ann presses **Make rejoin link**. Both players see "The host made a rejoin link for Bob's seat."
- [ ] Open the link in the fresh profile. It takes Bob's seat, and the address bar shows `/g/CODE` with no `#token=`.
- [ ] Bob's old profile shows "That seat link is no longer valid. Ask the host for a new rejoin link."
- [ ] For a live opponent, **Seat stuck?** shows the toast "<Name> is still connected… If they're stuck, try again in a minute."
- [ ] Turn off Wi-Fi on Bob's phone during his turn. After about 70 s, **Seat stuck?** reissues his seat, and his dot goes grey.

### Round end and reconnect

- [ ] Play to a round end. The scoreboard shows every breakdown row and each player's revealed hand.
- [ ] Both players press **Next round** together. The next round is dealt, and no error toast appears.
- [ ] Set the network to offline in devtools for about 60 s, then back online. "Reconnecting…" shows, then the same seat comes back. Cards set up in the staging area stay while offline.
- [ ] Optional: a tab left in the background for 3 minutes or more stays connected, with no dot flicker on other screens.

### Rules page and drawer

- [ ] On desktop, the `/rules` contents list stays in view while you scroll. `/rules#pickup` opens at "Picking up the pile".
- [ ] At 375 px, the contents are in a collapsible block, and nothing overflows sideways.
- [ ] Print preview hides the contents list and the Print button, and examples don't split across pages.
- [ ] In a game, **Rules** opens the drawer. **Why?** links open it at their section. Escape or **Close** returns with no "Reconnecting…" banner and with the staged cards kept.
- [ ] Read the "Standard Canasta" column of the house-rules table once. It comes from general knowledge, not from the spec.

## Known issues

These are known and recorded in the handoff. Don't log them as new bugs.

- A dead phone can show a green dot for up to 70 s, and longer if nobody acts. **Seat stuck?** is the way out.
- A toast that arrives while the rules drawer is open stays hidden until the drawer closes.
- After a mid-game "seat link is no longer valid" message, the join form still shows. Joining by name there fails with "Players can only join before the game starts."
- If the host loses their token mid-game, nobody can reissue seats.
- In rare cases, a dropped connection during a lobby join leaves an orphan seat. The host must kick it.

## Results and teardown

For each failure, record the checklist item, the browser or device, and what you saw. Add a screenshot if it shows the problem.

To tear down:

1. Press Ctrl-C in both terminals.
2. Optional: delete `apps/server/.wrangler/` to clear the local game storage. It is git-ignored.

When every item passes, the branch is ready to fast-forward merge into `main`.

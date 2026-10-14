from flask import Flask, jsonify, request, render_template
import secrets, string, threading

app = Flask(__name__)
lock = threading.RLock()
rooms = {}

def code6():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(6))

def error(message, status=400):
    return jsonify({'ok': False, 'error': message}), status

def room_for(code):
    return rooms.get((code or '').strip().upper())

@app.get('/')
def index():
    return render_template('index.html')

@app.get('/api/state')
def state():
    code = request.args.get('code', '').upper()
    room = room_for(code)
    if not room:
        return error('Room not found. Check the room code.', 404)
    with lock:
        return jsonify({'ok': True, 'room': public_room(room)})

def public_room(room):
    current = room['players'][room['current_index']] if room['current_index'] < len(room['players']) else None
    return {
        'code': room['code'], 'sport': room['sport'], 'budget': room['budget'],
        'status': room['status'], 'host_name': room['host_name'],
        'teams': list(room['teams'].values()), 'players': room['players'],
        'current_player': current, 'current_index': room['current_index'],
        'min_increment': room['min_increment'], 'last_message': room['last_message']
    }

@app.post('/api/create')
def create():
    data = request.get_json(force=True)
    host_name = str(data.get('host_name', 'Host')).strip()[:24] or 'Host'
    sport = data.get('sport', 'Cricket')
    if sport not in ('Cricket', 'Kabaddi', 'Football', 'Custom'):
        return error('Choose a supported sport.')
    try:
        budget = int(data.get('budget', 10000))
        increment = int(data.get('min_increment', 100))
    except (TypeError, ValueError):
        return error('Budget and bid increment must be whole numbers.')
    if budget < 1 or increment < 1 or budget > 1000000000:
        return error('Budget and bid increment must be positive numbers.')
    with lock:
        code = code6()
        while code in rooms: code = code6()
        host_id = secrets.token_urlsafe(18)
        room = {'code': code, 'host_id': host_id, 'host_name': host_name, 'sport': sport,
                'budget': budget, 'min_increment': increment, 'status': 'setup', 'teams': {},
                'players': [], 'current_index': 0, 'last_message': 'Room created. Add players and invite friends.'}
        rooms[code] = room
        return jsonify({'ok': True, 'code': code, 'host_id': host_id, 'room': public_room(room)})

@app.post('/api/join')
def join():
    data = request.get_json(force=True)
    code = str(data.get('code', '')).strip().upper()
    name = str(data.get('name', '')).strip()[:24]
    team_name = str(data.get('team_name', '')).strip()[:24]
    if not name or not team_name:
        return error('Enter both your name and team name.')
    with lock:
        room = room_for(code)
        if not room: return error('Room not found. Ask the host for the correct code.', 404)
        if room['status'] != 'setup': return error('This room has already started. New teams cannot join now.')
        if any(t['team_name'].lower() == team_name.lower() for t in room['teams'].values()):
            return error('That team name is already taken. Choose another.')
        if len(room['teams']) >= 12: return error('This room is limited to 12 teams.')
        team_id = secrets.token_urlsafe(16)
        team = {'id': team_id, 'name': name, 'team_name': team_name, 'budget': room['budget'], 'spent': 0, 'roster': [], 'connected': True}
        room['teams'][team_id] = team
        room['last_message'] = f'{team_name} joined the room.'
        return jsonify({'ok': True, 'team_id': team_id, 'room': public_room(room)})

def authorized(room, data):
    return room and secrets.compare_digest(str(data.get('host_id', '')), room['host_id'])


@app.post('/api/host_team')
def host_team():
    data = request.get_json(force=True); room = room_for(str(data.get('code', '')).upper())
    if not authorized(room, data): return error('Only the host can create the host team.', 403)
    name = str(data.get('name', '')).strip()[:24]
    team_name = str(data.get('team_name', '')).strip()[:24]
    if not name or not team_name: return error('Enter your name and team name.')
    with lock:
        if room['status'] != 'setup': return error('The auction has already started.')
        if any(t['team_name'].lower() == team_name.lower() for t in room['teams'].values()): return error('That team name is already taken.')
        if len(room['teams']) >= 12: return error('This room is limited to 12 teams.')
        team_id = secrets.token_urlsafe(16)
        room['teams'][team_id] = {'id': team_id, 'name': name, 'team_name': team_name, 'budget': room['budget'], 'spent': 0, 'roster': [], 'connected': True}
        room['last_message'] = f'{team_name} joined as the host team.'
        return jsonify({'ok': True, 'team_id': team_id, 'room': public_room(room)})

@app.post('/api/player')
def add_player():
    data = request.get_json(force=True); code = str(data.get('code', '')).upper(); room = room_for(code)
    if not authorized(room, data): return error('Only the host can manage the player list.', 403)
    name = str(data.get('name', '')).strip()[:40]; role = str(data.get('role', '')).strip()[:30]
    try: base = int(data.get('base_price', 100))
    except (TypeError, ValueError): return error('Base price must be a whole number.')
    if not name or not role: return error('Enter a player name and role.')
    if base < 0 or base > room['budget']: return error('Base price must be between 0 and the team budget.')
    with lock:
        if room['status'] != 'setup': return error('The auction has already started.')
        if any(p['name'].lower() == name.lower() for p in room['players']): return error('A player with that name already exists.')
        room['players'].append({'id': secrets.token_urlsafe(10), 'name': name, 'role': role, 'base_price': base,
                                'status': 'pending', 'sold_to': None, 'sold_price': 0, 'current_bid': 0, 'bid_team_id': None})
        room['last_message'] = f'{name} added to the player pool.'
        return jsonify({'ok': True, 'room': public_room(room)})

@app.post('/api/remove_player')
def remove_player():
    data = request.get_json(force=True); room = room_for(str(data.get('code','')).upper())
    if not authorized(room, data): return error('Only the host can manage players.', 403)
    with lock:
        if room['status'] != 'setup': return error('Players can only be removed before the auction starts.')
        room['players'] = [p for p in room['players'] if p['id'] != data.get('player_id')]
        return jsonify({'ok': True, 'room': public_room(room)})

@app.post('/api/start')
def start():
    data = request.get_json(force=True); room = room_for(str(data.get('code','')).upper())
    if not authorized(room, data): return error('Only the host can start the auction.', 403)
    with lock:
        if room['status'] != 'setup': return error('The auction has already started.')
        if len(room['teams']) < 1: return error('At least one team must join before starting.')
        if not room['players']: return error('Add at least one player before starting.')
        room['status'] = 'live'; room['current_index'] = 0
        p = room['players'][0]; p['status'] = 'live'; p['current_bid'] = p['base_price']
        room['last_message'] = f"Auction started! First up: {p['name']} ({p['role']})."
        return jsonify({'ok': True, 'room': public_room(room)})

@app.post('/api/bid')
def bid():
    data = request.get_json(force=True); room = room_for(str(data.get('code','')).upper())
    team = room['teams'].get(str(data.get('team_id',''))) if room else None
    if not team: return error('Team not found in this room.', 403)
    with lock:
        if room['status'] != 'live': return error('The auction is not live.')
        p = room['players'][room['current_index']]
        if p['status'] != 'live': return error('This player is no longer open for bidding.')
        next_bid = p['current_bid'] + room['min_increment'] if p['bid_team_id'] else p['base_price']
        if team['id'] == p['bid_team_id']: return error('Another team must bid before you can raise your own bid.')
        if team['budget'] < next_bid: return error(f"Your remaining budget is too low for the next bid ({next_bid}).")
        if len(team['roster']) >= 25: return error('Your team roster is full (25 players).')
        p['current_bid'] = next_bid; p['bid_team_id'] = team['id']
        room['last_message'] = f"{team['team_name']} bid {next_bid} for {p['name']}."
        return jsonify({'ok': True, 'room': public_room(room)})

@app.post('/api/close_player')
def close_player():
    data = request.get_json(force=True); room = room_for(str(data.get('code','')).upper())
    if not authorized(room, data): return error('Only the host can close bidding.', 403)
    with lock:
        if room['status'] != 'live': return error('The auction is not live.')
        p = room['players'][room['current_index']]
        if p['bid_team_id']:
            team = room['teams'][p['bid_team_id']]
            price = p['current_bid']; team['budget'] -= price; team['spent'] += price
            team['roster'].append({'id': p['id'], 'name': p['name'], 'role': p['role'], 'price': price})
            p['status'] = 'sold'; p['sold_to'] = team['team_name']; p['sold_price'] = price
            room['last_message'] = f"SOLD! {p['name']} to {team['team_name']} for {price}."
        else:
            p['status'] = 'unsold'; room['last_message'] = f"UNSOLD: {p['name']} received no bids."
        return jsonify({'ok': True, 'room': public_room(room)})

@app.post('/api/next')
def next_player():
    data = request.get_json(force=True); room = room_for(str(data.get('code','')).upper())
    if not authorized(room, data): return error('Only the host can move to the next player.', 403)
    with lock:
        if room['status'] != 'live': return error('The auction is not live.')
        current = room['players'][room['current_index']]
        if current['status'] == 'live': return error('Close bidding for this player first.')
        idx = room['current_index'] + 1
        while idx < len(room['players']) and room['players'][idx]['status'] != 'pending': idx += 1
        if idx >= len(room['players']):
            room['status'] = 'finished'; room['last_message'] = 'Auction complete! Check the final team results.'
        else:
            room['current_index'] = idx; p = room['players'][idx]
            p['status'] = 'live'; p['current_bid'] = p['base_price']; p['bid_team_id'] = None
            room['last_message'] = f"Next player: {p['name']} ({p['role']})."
        return jsonify({'ok': True, 'room': public_room(room)})

@app.get('/health')
def health(): return jsonify({'ok': True, 'service': 'Offline Sports Auction'})

if __name__ == '__main__':
    print('\nOFFLINE SPORTS AUCTION')
    port = int(__import__('os').environ.get('PORT', '5000'))
    print(f'Open http://127.0.0.1:{port} on this computer.')
    print('For global multiplayer, deploy this service to a public Python host and share its HTTPS URL.')
    print('Room data is temporary and resets when the server restarts. Press Ctrl+C to stop.\n')
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)

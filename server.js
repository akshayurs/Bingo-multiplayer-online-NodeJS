'use strict'
const express = require('express')
const sanitizeHTML = require('sanitize-html')
const { SocketAddress } = require('net')
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const PORT = process.env.PORT || 3000

app.set('views', 'views')
app.set('view engine', 'ejs')

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.render('game', { roomid: '' })
})
app.get('/join/:roomid', (req, res) => {
  res.render('game', { roomid: req.params.roomid.toLowerCase() })
})
app.use((req, res, next) => {
  res.send(`<a href="/">Go to Home Page</a>`)
})

//Shuffled array
function generateBox() {
  let arr = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25,
  ]
  for (let i = 1; i < 25; i++) {
    const j = Math.floor(Math.random() * (i - 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }
  return arr
}

//Shuffle letters
function generateRoomId() {
  let random = ''
  let arr = 'abcdefghijklmnopqrstuvwxyz'
  for (let i = 1; i < 7; i++) {
    random += arr.charAt(Math.floor(Math.random() * arr.length))
  }
  return random
}

//Check for Valid Click and send to opponent
function onClick(socketId, cellId) {
  let { player, roomid } = users[socketId]
  if (isRoomValid(roomid)) {
    let roomObject = rooms[roomid]
    if (users[socketId]['player'] == roomObject['turn']) {
      let box = roomObject[`box-clicked`]
      let opponent = player == 1 ? 2 : 1
      if (
        !box.has(roomObject[`player${player}-box`][cellId - 1]) &&
        cellId <= 25 &&
        cellId >= 1
      ) {
        let val = roomObject[`player${player}-box`][cellId - 1]
        let index = roomObject[`player${opponent}-box`].indexOf(val) + 1
        roomObject[`box-clicked`].add(val)
        io.to(roomObject[`player${opponent}-socket`]).emit('opponent-clicked', {
          clickid: index,
          turn: true,
        })
      } else {
        io.to(socketId).emit('error', { error: 'TRYING TO CHEAT' })
        removeUser(socketId)
        return
      }
      roomObject['turn'] = roomObject['turn'] == 1 ? 2 : 1
      let won = checkWin(socketId)
      let won1 = checkWin(roomObject[`player${opponent}-socket`])
      if (won || won1) {
        setBoxAfterWin(roomid)
      }
    }
  } else {
    io.to(socketId).emit('error', { error: 'user invalid' })
    removeUser(socketId)
    return
  }
}

//check for winning combinations
function checkWin(socketId) {
  if (!users.hasOwnProperty(socketId)) {
    return 0
  }
  const wincomb = [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
    [11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20],
    [21, 22, 23, 24, 25],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    [5, 10, 15, 20, 25],
    [1, 7, 13, 19, 25],
    [5, 9, 13, 17, 21],
  ]
  let { player, roomid } = users[socketId]
  let box = rooms[roomid][`player${player}-box`]
  let clicked = rooms[roomid][`box-clicked`]
  let playerBingo = 0
  wincomb.forEach((comb) => {
    if (
      clicked.has(box[comb[0] - 1]) &&
      clicked.has(box[comb[1] - 1]) &&
      clicked.has(box[comb[2] - 1]) &&
      clicked.has(box[comb[3] - 1]) &&
      clicked.has(box[comb[4] - 1])
    ) {
      playerBingo++
    }
  })
  io.to(socketId).emit('player-bingo', { bingo: playerBingo })
  io.to(rooms[roomid][`player${player == 1 ? 2 : 1}-socket`]).emit(
    'opponent-bingo',
    { bingo: playerBingo }
  )
  if (playerBingo >= 5) {
    handelWin(socketId)
    return 1
  }
  return 0
}

//handel win
function handelWin(socketId) {
  let { player, roomid } = users[socketId]
  let roomObject = rooms[roomid]
  roomObject[`player${player}-score`] = roomObject[`player${player}-score`] + 1
  let score_won = roomObject[`player${player}-score`]
  let score_lost = roomObject[`player${player == 1 ? 2 : 1}-score`]
  io.to(roomObject[`player${player == 1 ? 2 : 1}-socket`]).emit(
    'opponent-won',
    { yourScore: score_lost, opponentScore: score_won, turn: false }
  )
  io.to(socketId).emit('you-won', {
    yourScore: score_won,
    opponentScore: score_lost,
    turn: true,
  })
  roomObject['turn'] = player
}

// set box after handel win
function setBoxAfterWin(roomid) {
  let roomObject = rooms[roomid]
  let box1 = generateBox()
  let box2 = generateBox()
  roomObject['player1-box'] = box1
  roomObject['player2-box'] = box2
  roomObject['box-clicked'] = new Set()
  io.to(roomObject[`player1-socket`]).emit('set-box', { box: box1 })
  io.to(roomObject[`player2-socket`]).emit('set-box', { box: box2 })
}

//remove user from server data
function removeUser(socketId) {
  if (users.hasOwnProperty(socketId)) {
    if (rooms.hasOwnProperty(users[socketId].roomid)) {
      let opponent = users[socketId].player == 1 ? 2 : 1
      let opponentSocket =
        rooms[users[socketId].roomid][`player${opponent}-socket`]
      io.to(opponentSocket).emit('error', { error: 'Opponent Disconnected' })
      delete rooms[users[socketId].roomid]
    }
    delete users[socketId]
  }
  if (socketId == lobby) {
    lobby = ''
  }
}

//player joined
function handelJoin(socketId, roomid, name, avatar) {
  if (isRoomValid(roomid)) {
    let roomObject = rooms[roomid]
    users[socketId] = { name: name, roomid: roomid, player: 2 }
    let box = generateBox()
    storeUser(socketId, roomid, name, avatar, 2)
    roomObject['player2-box'] = box
    io.to(roomObject[`player1-socket`]).emit('other-player-joined', {
      player: name,
      avatar: avatar,
    })
    io.to(socketId).emit('joined', {
      player: roomObject[`player1-name`],
      box: box,
      avatar: roomObject[`player1-avatar`],
    })
    io.to(roomObject[`player1-socket`]).emit('start-game', { turn: true })
    io.to(socketId).emit('start-game', { turn: false })
  } else {
    io.to(socketId).emit('error', { error: 'enter valid room id' })
    removeUser(socketId)
    return
  }
}

//player hosted
function handelHost(socketId, name, avatar) {
  let roomid = generateRoomId()
  users[socketId] = { name: name, roomid: roomid, player: 1 }
  let box = generateBox()
  storeUser(socketId, roomid, name, avatar, 1)
  rooms[roomid]['player1-box'] = box
  rooms[roomid]['turn'] = 1
  io.to(socketId).emit('hosted', { box: box, roomid: roomid })
}

//to handel random-mode connected players
function handelRandom(socketId, name, avatar) {
  let box = generateBox()
  if (lobby == '') {
    lobby = socketId
    let roomid = generateRoomId()
    users[socketId] = { name: name, roomid: roomid, player: 1 }
    storeUser(socketId, roomid, name, avatar, 1)
    rooms[roomid]['turn'] = 1
    rooms[roomid]['player1-box'] = box
    io.to(socketId).emit('random-joined', { box: box })
  } else {
    let opponentSocket = lobby
    lobby = ''
    let roomid = users[opponentSocket].roomid
    users[socketId] = { name: name, roomid: roomid, player: 2 }
    storeUser(socketId, roomid, name, avatar, 2)
    rooms[roomid]['player2-box'] = box
    rooms[roomid]['turn'] = 1
    io.to(socketId).emit('random-joined', { box: box })
    io.to(socketId).emit('start-game', { turn: false })
    io.to(opponentSocket).emit('start-game', { turn: true })
    io.to(opponentSocket).emit('other-player-joined', {
      player: name,
      avatar: avatar,
    })
    io.to(socketId).emit('other-player-joined', {
      player: rooms[roomid]['player1-name'],
      avatar: rooms[roomid]['player1-avatar'],
    })
  }
}

//store user to rooms and users object
function storeUser(socketId, roomid, name, avatar, player) {
  if (!rooms.hasOwnProperty(roomid)) {
    rooms[roomid] = {}
  }
  let roomObject = rooms[roomid]
  roomObject[`player${player}-name`] = name
  roomObject[`player${player}-avatar`] = avatar
  roomObject[`player${player}-socket`] = socketId
  roomObject[`player${player}-score`] = 0
  roomObject[`box-clicked`] = new Set()
}

//check room is valid or not
function isRoomValid(roomid) {
  let valid = true
  if (rooms.hasOwnProperty(roomid)) {
    if (rooms[roomid].hasOwnProperty('player2_name')) {
      valid = false
    }
  } else {
    valid = false
  }
  return valid
}
//chatting inside game
function handlechat(socketId, msg) {
  let { player, roomid } = users[socketId]
  io.to(rooms[roomid][`player${player == 1 ? 2 : 1}-socket`]).emit('chat', {
    msg,
  })
  console.log(msg)
}

//game data
var users = new Object()
var rooms = new Object()
var lobby = ''

// game connections with socket
io.on('connection', (socket) => {
  socket.on('host', (data) => {
    let num = parseInt(data.avatar)
    data.name = sanitizeHTML(data.name, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim()
    if (isNaN(num) || num < 1 || num > 8) {
      socket.emit('error', { error: 'avatar not selected' })
      removeUser(socket.id)
      return
    }
    if (data.name == '' || data.name == 'null' || data.name == undefined) {
      socket.emit('error', { error: 'Name incorrect' })
      removeUser(socket.id)
      return
    }
    handelHost(socket.id, data.name, data.avatar)
  })
  socket.on('join', (data) => {
    let num = parseInt(data.avatar)
    data.name = sanitizeHTML(data.name, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim()
    if (isNaN(num) || num < 1 || num > 8) {
      socket.emit('error', { error: 'avatar not selected' })
      removeUser(socket.id)
      return
    }
    if (data.name == '' || data.name == 'null' || data.name == undefined) {
      socket.emit('error', { error: 'Name incorrect' })
      removeUser(socket.id)
      return
    }
    if (
      data.roomid == '' ||
      data.roomid == 'null' ||
      data.roomid == undefined
    ) {
      socket.emit('error', { error: 'roomid incorrect' })
      removeUser(socket.id)
      return
    }
    handelJoin(socket.id, data.roomid.toLowerCase(), data.name, data.avatar)
  })
  socket.on('clicked', (data) => {
    if (typeof data.cellid != 'number' || isNaN(data.cellid)) {
      socket.emit('error', { error: 'invalid click' })
      removeUser(socket.id)
      return
    }
    if (!users.hasOwnProperty(socket.id)) {
      socket.emit('error', { error: 'User Invalid' })
      removeUser(socket.id)
      return
    }
    if (!rooms.hasOwnProperty(users[socket.id].roomid)) {
      socket.emit('error', { error: 'Roomid Invalid' })
      removeUser(socket.id)
      return
    }

    onClick(socket.id, parseInt(data.cellid))
  })
  socket.on('chat', (data) => {
    data.msg = sanitizeHTML(data.msg, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim()
    if (!users.hasOwnProperty(socket.id)) {
      socket.emit('error', { error: 'User Invalid' })
      removeUser(socket.id)
      return
    }
    if (!rooms.hasOwnProperty(users[socket.id].roomid)) {
      socket.emit('error', { error: 'Roomid Invalid' })
      removeUser(socket.id)
      return
    }
    handlechat(socket.id, data.msg)
  })
  socket.on('disconnect', () => {
    removeUser(socket.id)
  })
  socket.on('random', (data) => {
    data.name = sanitizeHTML(data.name, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim()
    let num = parseInt(data.avatar)
    if (isNaN(num) || num < 1 || num > 8) {
      socket.emit('error', { error: 'avatar not selected' })
      removeUser(socket.id)
      return
    }
    if (data.name == '' || data.name == 'null' || data.name == undefined) {
      socket.emit('error', { error: 'Name incorrect' })
      removeUser(socket.id)
      return
    }
    handelRandom(socket.id, data.name, data.avatar)
  })
})

//listening on port
http.listen(PORT, () => console.log(`Server running on PORT : ${PORT}`))

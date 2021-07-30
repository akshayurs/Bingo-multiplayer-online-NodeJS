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

//Shuffled array
function generateBox() {
    let arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
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
    if (users.hasOwnProperty(socketId)) {
        let { player, roomid } = users[socketId]
        if (isRoomValid(roomid)) {
            if (users[socketId]['player'] == rooms[roomid]['turn']) {
                let box = rooms[roomid][`box-clicked`]
                let opponent = player == 1 ? 2 : 1
                if (box.indexOf(cellId) == -1 && cellId <= 25 && cellId >= 1) {
                    let val = rooms[roomid][`player${player}-box`][cellId - 1]
                    let index = rooms[roomid][`player${opponent}-box`].indexOf(val) + 1
                    rooms[roomid][`box-clicked`].push(val)
                    io.to(rooms[roomid][`player${opponent}-socket`]).emit("opponent-clicked", { clickid: index, turn: true })
                } else {
                    io.to(socketId).emit("cheat", { error: "TRYING TO CHEAT" })
                }
                checkWin(socketId)
                checkWin(rooms[roomid][`player${opponent}-socket`])
                rooms[roomid]['turn'] = rooms[roomid]['turn'] == 1 ? 2 : 1
            }
        }
    } else {
        io.to(socketId).emit("error", { error: "user invalid" })
    }

}

//check for winning combinations
function checkWin(socketId) {
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
        [5, 9, 13, 17, 21]
    ]
    let { player, roomid } = users[socketId]
    let box = rooms[roomid][`player${player}-box`]
    let clicked = rooms[roomid][`box-clicked`]
    let playerBingo = 0
    for (let comb of wincomb) {
        if (clicked.indexOf(box[comb[0] - 1]) != -1 && clicked.indexOf(box[comb[1] - 1]) != -1 && clicked.indexOf(box[comb[2] - 1]) != -1 && clicked.indexOf(box[comb[3] - 1]) != -1 && clicked.indexOf(box[comb[4] - 1]) != -1) {
            playerBingo++;
        }
    }
    io.to(socketId).emit("player-bingo", { bingo: playerBingo })
    io.to(rooms[roomid][`player${player == 1 ? 2 : 1}-socket`]).emit("opponent-bingo", { bingo: playerBingo })

    if (playerBingo >= 5) {
        handelWin(socketId)
    }
}

//handel win
function handelWin(socketId) {
    let { player, roomid } = users[socketId]
    let score_won = rooms[roomid][`player${player}-score`] + 1
    let score_lost = rooms[roomid][`player${player}-score`]
    rooms[roomid][`player${player}-score`] = score_won
    let box1 = generateBox()
    let box2 = generateBox()
    rooms[roomid]['player1-box'] = box1
    rooms[roomid]['player2-box'] = box2
    rooms[roomid]['box-clicked'] = []
    io.to(rooms[roomid][`player${player == 1 ? 2 : 1}-socket`]).emit("opponent-won", { box: player == 1 ? box2 : box1, yourScore: score_lost, opponentScore: score_won, turn: false })
    io.to(socketId).emit("you-won", { box: player == 1 ? box1 : box2, yourScore: score_won, opponentScore: score_lost, turn: true })
}

//remove user from server data
function removeUser(socketId) {
    if (users.hasOwnProperty(socketId)) {
        if (rooms.hasOwnProperty(users[socketId].roomid)) {
            let opponent = users[socketId].player == 1 ? 2 : 1
            let opponentSocket = rooms[users[socketId].roomid][`player${opponent}-socket`]
            io.to(opponentSocket).emit('error', { error: "Opponent Disconnected" })
            delete rooms[users[socketId].roomid]
        }
        delete users[socketId]
    }
    lobby = lobby.filter(id => id != socketId)
}

//player joined
function handelJoin(socketId, roomid, name, avatar) {
    if (isRoomValid(roomid)) {
        users[socketId] = { name: name, roomid: roomid, player: 2 }
        let box = generateBox()
        storeUser(socketId, roomid, name, avatar, 2)
        rooms[roomid]['player2-box'] = box
        io.to(rooms[roomid][`player1-socket`]).emit("other-player-joined", { player: name, avatar: avatar })
        io.to(socketId).emit("joined", { player: rooms[roomid][`player1-name`], box: box, avatar: rooms[roomid][`player1-avatar`] })
        io.to(rooms[roomid][`player1-socket`]).emit("start-game", { turn: true })
        io.to(socketId).emit("start-game", { turn: false })
    } else {
        io.to(socketId).emit("error", { error: "enter valid room id" })
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
    io.to(socketId).emit("hosted", { box: box, roomid: roomid })
}

//to handel random-mode connected players
function handelRandom(socketId, name, avatar) {
    if (lobby.length == 0) {
        lobby.push(socketId)
        let box = generateBox()
        let roomid = generateRoomId()
        users[socketId] = { name: name, roomid: roomid, player: 1 }
        storeUser(socketId, roomid, name, avatar, 1)
        rooms[roomid]['player1-box'] = box
        rooms[roomid]['turn'] = 1
        io.to(socketId).emit("random-joined", { box: box })
    } else {
        let opponentSocket = lobby.shift()
        let box = generateBox()
        let roomid = users[opponentSocket].roomid
        users[socketId] = { name: name, roomid: roomid, player: 2 }
        storeUser(socketId, roomid, name, avatar, 2)
        rooms[roomid]['player2-box'] = box
        rooms[roomid]['turn'] = 1
        io.to(socketId).emit("random-joined", { box: box })
        io.to(socketId).emit('start-game', { turn: false })
        io.to(opponentSocket).emit('start-game', { turn: true })
        io.to(opponentSocket).emit('other-player-joined', { player: name, avatar: avatar })
        io.to(socketId).emit('other-player-joined', { player: rooms[roomid]['player1-name'], avatar: rooms[roomid]['player1-avatar'] })
    }
}

//store user to rooms and users object 
function storeUser(socketId, roomid, name, avatar, player) {
    if (!rooms.hasOwnProperty(roomid)) {
        rooms[roomid] = {}
    }
    console.log(name)
    rooms[roomid][`player${player}-name`] = name
    rooms[roomid][`player${player}-avatar`] = avatar
    rooms[roomid][`player${player}-socket`] = socketId
    rooms[roomid][`player${player}-score`] = 0
    rooms[roomid][`box-clicked`] = []
}

//check room is valid or not
function isRoomValid(roomid) {
    let valid = true
    if (rooms.hasOwnProperty(roomid)) {
        if (rooms[roomid].hasOwnProperty("player2_name")) {
            valid = false
        }
    } else {
        valid = false
    }
    return valid
}

//game data
var users = new Object()
var rooms = new Object()
var lobby = []

// game connections with socket
io.on('connection', socket => {
    socket.on("host", (data) => {
        let num = parseInt(data.avatar)
        if (num == NaN || num < 1 || num > 6) {
            socket.emit("error", { error: "avatar not selected" })
            return
        }
        if (data.name == "" || data.name == "null" || data.name == undefined) {
            socket.emit("error", { error: "Name incorrect" })
            return
        }
        handelHost(socket.id, sanitizeHTML(data.name, { allowedTags: [], allowedAttributes: {} }), data.avatar)
    })
    socket.on("join", data => {
        let num = parseInt(data.avatar)
        if (num == NaN || num < 1 || num > 6) {
            socket.emit("error", { error: "avatar not selected" })
            return
        }
        if (data.name == "" || data.name == "null" || data.name == undefined) {
            socket.emit("error", { error: "Name incorrect" })
            return
        }
        if (data.roomid == "" || data.roomid == "null" || data.roomid == undefined) {
            socket.emit("error", { error: "roomid incorrect" })
            return
        }
        handelJoin(socket.id, data.roomid.toLowerCase(), sanitizeHTML(data.name, { allowedTags: [], allowedAttributes: {} }), data.avatar)
    })
    socket.on('clicked', data => {
        onClick(socket.id, data.cellid)
    })
    socket.on("disconnect", () => {
        removeUser(socket.id)
    })
    socket.on('random', (data) => {
        let num = parseInt(data.avatar)
        if (num == NaN || num < 1 || num > 6) {
            socket.emit("error", { error: "avatar not selected" })
            return
        }
        if (data.name == "" || data.name == "null" || data.name == undefined) {
            socket.emit("error", { error: "Name incorrect" })
            return
        }
        handelRandom(socket.id, data.name, data.avatar)
    })
})

//listening on port
http.listen(PORT, () => console.log(`Server running on PORT : ${PORT}`))

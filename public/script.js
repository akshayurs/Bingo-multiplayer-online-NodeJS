'use strict'
var name = ""
var avatar = ""
var skip = false
if (roomid != "") {
    skip = true
}
let storagename = localStorage.getItem('bingo-name')
if (storagename) {
    document.querySelector('#input-name').value = storagename
}
window.addEventListener('load', () => {
    document.querySelector('.preloader').style.display = "none"
    document.querySelector('[name="theme-color"]').setAttribute('content', "lightgrey")
    if (!skip) {
        document.querySelector(".slide1").style.display = "block"
    } else {
        document.querySelector(".slide2").style.display = "block"
    }
})
document.querySelector('.play-button').addEventListener('click', (e) => {
    document.querySelector(".slide1").style.display = "none"
    document.querySelector(".slide2").style.display = "block"
    document.querySelector('#next-sound').play()
})
document.querySelector('.next-btn').addEventListener('click', (e) => {
    name = document.querySelector('#input-name').value
    localStorage.setItem("bingo-name", name)
    if (name != "") {
        document.querySelector('#next-sound').play()
        document.querySelector(".slide2").style.display = "none"
        document.querySelector(".slide3").style.display = "block"
        document.querySelector('#entered-name').innerHTML = name
    }
})
document.querySelectorAll('.avatars').forEach((e) => {
    e.addEventListener('click', (e) => {
        document.querySelector('#next-sound').play()
        avatar = e.target.getAttribute("data-id")
        document.querySelector(".slide3").style.display = "none"
        document.querySelector('#player-avatar').src = `/images/avatar${avatar}.png`
        document.querySelector('#selected-avatar').src = `/images/avatar${avatar}.png`
        document.querySelector('[name="theme-color"]').setAttribute('content', "#AA3036")
        if (!skip) {
            document.querySelector(".slide4").style.display = "flex"
        } else {
            document.querySelector(".slide5").style.display = "block"
            handelJoin()
        }
    })
})
document.querySelector('#random-btn').addEventListener('click', (e) => {
    document.querySelector('#next-sound').play()
    document.querySelector(".slide4").style.display = "none"
    document.querySelector(".slide5").style.display = "block"
    document.querySelector('[name="theme-color"]').setAttribute('content', "darkgreen")
    handelRandom()
})
document.querySelector('#join-btn').addEventListener('click', (e) => {
    document.querySelector('#next-sound').play()
    document.querySelector(".slide4").style.display = "none"
    document.querySelector(".slide5").style.display = "block"
    document.querySelector('[name="theme-color"]').setAttribute('content', "darkgreen")
    handelJoin()
})
document.querySelector('#host-btn').addEventListener('click', (e) => {
    document.querySelector('#next-sound').play()
    document.querySelector(".slide4").style.display = "none"
    document.querySelector(".slide5").style.display = "block"
    document.querySelector('[name="theme-color"]').setAttribute('content', "darkgreen")
    handelHost()
})
document.querySelectorAll('.form-prevent').forEach(ele => {
    ele.addEventListener("submit", (e) => {
        e.preventDefault()
    })
})
document.querySelector('.chat-btn').addEventListener('click', () => {
    let input = document.querySelector('.chat-input').value
    let msg = input.value
    if (msg != "") {
        socket.emit("chat", { msg })
        input.value = ""
    }
})


//GAME
//game data
var clicked = new Set()
var isPlayerMove = false
var name = ""
var socket = io()
var prevOpponentBingo = 0
var prevPlayerBingo = 0
var timer
//copy to clipbard
function copyToClipboard() {
    var aux = document.createElement("input");
    let room = document.getElementById('room-id').innerHTML
    alert(`${room} copied to clipboard`)
    aux.setAttribute("value", room);
    document.body.appendChild(aux);
    aux.select();
    document.execCommand("copy");
    document.body.removeChild(aux);
}

//getting username
function getUsername() {
    name = prompt("Enter Your name")
}

//add events
function addEventsToCells() {
    document.querySelectorAll('.cell').forEach(e => {
        e.addEventListener('click', (e) => handelClick(e.target.id))
    })
}

//create and fill 25 cells with numbers 
function createCells(arr) {
    document.querySelector('.box').innerHTML = ""
    for (let i = 1; i <= 25; i++) {
        let element = document.createElement('div')
        element.classList.add('cell', 'grid')
        element.id = i
        element.innerText = arr[i - 1]
        document.querySelector('.box').insertAdjacentElement('beforeend', element)
    }
    addEventsToCells()
}

//Fill green color to BINGO
function fillBingo(player, num) {
    num = num > 5 ? 5 : num
    for (let i = 1; i <= num; i++) {
        document.querySelector(`#${player}-letter-${i}`).style.backgroundColor = '#ac0081'
        document.querySelector(`#${player}-letter-${i}`).style.color = 'White'
    }
    for (let i = num + 1; i <= 5; i++) {
        document.querySelector(`#${player}-letter-${i}`).style.backgroundColor = 'rgb(235, 235, 235)'
        document.querySelector(`#${player}-letter-${i}`).style.color = 'black'
    }
}

//Make bingo Zero in each play
function zeroBingo() {
    fillBingo('player', 0)
    fillBingo('opponent', 0)
}

//Fill green color when clicked
function fillCell(index) {
    document.getElementById(index).style.backgroundColor = 'teal'
    document.getElementById(index).style.color = 'white'
}

//Check click is valid or not
function checkClick(index) {
    return !clicked.has(index)
}

//change score
function setScore(player, opponent) {
    document.querySelector(".player-score").innerHTML = player
    document.querySelector(".opponent-score").innerHTML = opponent
}

//add msgs to page
function addchat(msg) {
    document.querySelector('#chat-sound').play()
    let ele = document.createElement('div')
    ele.classList.add('received-msg')
    ele.innerHTML = msg
    let parent = document.querySelector('.received-msgs')
    parent.appendChild(ele)
    timer = setTimeout(() => {
        parent.removeChild(ele)
    }, 5000)
}

//Handel click in game
function handelClick(index) {
    index = parseInt(index)
    if (checkClick(index) && isPlayerMove) {
        document.getElementById("player1-sound").play()
        clicked.add(index)
        fillCell(index)
        socket.emit("clicked", { cellid: index })
        isPlayerMove = false
        document.querySelector('.move').innerHTML = "Opponent's Turn"
        console.log("clicked box you clicked", clicked)
    }
}

// Handel HOST
function handelHost() {
    if (name != "" && name != "null" && name != undefined) {
        socket.emit("host", { name: name, avatar: avatar })
    } else {
        getUsername()
        document.querySelector("#host-btn").click()
    }
}

//Handel JOIN
function handelJoin() {
    let enteredValue
    if (!skip) {
        enteredValue = prompt("enter room id")
    } else {
        enteredValue = roomid
    }
    if (enteredValue == "" || enteredValue == "null" || enteredValue == undefined) {
        alert("PLEASE ENTER CORRECT VALUE NEXT TIME")
        location.replace(location.protocol + "//" + location.host);
        return
    }
    if (name != "" && name != "null" && name != undefined && enteredValue != "") {
        document.querySelector("#room-id").style.display = "none"
        document.querySelector(".share").style.display = "none"
        document.querySelector(".player-name").innerHTML = name
        socket.emit("join", { name: name, roomid: enteredValue, avatar: avatar })
    }
    if (name == "" || name == "null" || name == undefined) {
        getUsername()
        document.querySelector("#join-btn").click()
    }

}

//Handel random join
function handelRandom() {
    if (name != "" && name != "null" && name != undefined) {
        document.querySelector("#roomid").style.display = "none"
        document.querySelector(".share").style.display = "none"
        document.querySelector(".player-name").innerHTML = name
        socket.emit("random", { name: name, avatar: avatar })
    } else {
        getUsername()
        document.querySelector("#random-btn").click()
    }
}


//handelGame connection with socket

socket.on('other-player-joined', data => {
    document.querySelector('.player-name').innerHTML = name
    document.querySelector('.opponent-name').innerHTML = data.player
    document.querySelector('#opponent-avatar').src = `/images/avatar${data.avatar}.png`
})

socket.on("opponent-clicked", (data) => {
    document.getElementById("player2-sound").play()
    clicked.add(data.clickid)
    fillCell(data.clickid)
    isPlayerMove = data.turn
    document.querySelector('.move').innerHTML = "Your Turn"
    console.log("opponent clicked socket data", data)
    console.log("clicked box after opponent-clicked", clicked)
})
socket.on("opponent-bingo", (data) => {
    if (prevOpponentBingo != data.bingo) {
        prevOpponentBingo = data.bingo
        fillBingo("opponent", prevOpponentBingo)
    }
})

socket.on("player-bingo", (data) => {
    if (prevPlayerBingo != data.bingo) {
        prevPlayerBingo = data.bingo
        fillBingo("player", prevPlayerBingo)
    }
})

socket.on("error", (data) => {
    alert(data.error)
    location.replace(location.protocol + "//" + location.host);
})

socket.on("hosted", (data) => {
    createCells(data.box)
    document.querySelector('.player-name').innerHTML = name
    document.getElementById("room-id").innerHTML = data.roomid
    document.getElementById('whatsapplink').href = `whatsapp://send?text=${name} has invited you to join Bingo Online Multiplayer Game.%0D%0A %0D%0AClick the link to join game %0D%0A${location.protocol}//${location.host}/join/${data.roomid}`
})

socket.on('opponent-won', data => {
    document.getElementById("lossing-sound").play()
    setScore(data.yourScore, data.opponentScore)
    isPlayerMove = data.turn
})

socket.on('you-won', data => {
    document.getElementById("winning-sound").play()
    setScore(data.yourScore, data.opponentScore)
    isPlayerMove = data.turn
})

socket.on('set-box', data => {
    let prevTurnValue = isPlayerMove
    isPlayerMove = false
    setTimeout(() => {
        clicked = new Set()
        zeroBingo()
        createCells(data.box)
    }, 1500)
    isPlayerMove = prevTurnValue
    if (isPlayerMove) {
        document.querySelector('.move').innerHTML = "Your Turn"
    } else {
        document.querySelector('.move').innerHTML = "Opponent's Turn"
    }
})

socket.on("joined", (data) => {
    createCells(data.box)
    document.querySelector('.opponent-name').innerHTML = data.player
    document.querySelector('#opponent-avatar').src = `/images/avatar${data.avatar}.png`
})

socket.on('random-joined', data => {
    createCells(data.box)
})

socket.on('start-game', data => {
    document.querySelector('#next-sound').play()
    document.querySelector('.slide5').style.display = "none"
    document.querySelector('.game-screen').style.display = "flex"
    document.querySelector('[name="theme-color"]').setAttribute('content', "black")
    isPlayerMove = data.turn
    if (isPlayerMove) {
        document.querySelector('.move').innerHTML = "Your Turn"
    } else {
        document.querySelector('.move').innerHTML = "Opponent's Turn"
    }
})

socket.on('chat', data => {
    addchat(data.msg)
})

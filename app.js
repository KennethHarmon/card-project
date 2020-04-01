///////////////////////////REQUIRES/////////////////////////////////

var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var bodyParser = require("body-parser");
const fs = require('fs');
const maindeck = require("./cards.json")

app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static("public"));
app.set("view engine", "ejs")

///////////////////////////////////////////Server Variables/////////////////////////////////////
var playerList = [];
var lobbyList = {};

var masterDeck = maindeck;

////////////////////////////////////////////PAGE ROUTES////////////////////////////////////////

//Serve index page
app.get('/', function(req, res){
  console.log("playerList: " + playerList);
  console.log("lobbyList: " + lobbyList)
  res.render("index")
});

//Serve game page
app.get("/game", function(req,res) {
  res.render("game", {username: req.query.username, lobbycode: req.query.lobbycode})
})

app.post("/game/join", function(req,res) {
  var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
  console.log(req.body.username)
  var username = req.body.username.toLowerCase();
  var gameCode = req.body.gameCode;

  checkUserExists(username, function(existsResponse) {
    if (existsResponse === false) {
      console.log("No user exists")
      createPlayer(username, ip);
      addToLobby(username,gameCode);
      res.redirect("/game?username=" + username + "&lobbycode=" + gameCode);
    }
    else {
      console.log("User already exists, can't join lobby")
      res.redirect("/");
    }
  });

})

//Create a new game
app.post('/game/new', function(req, res){
  var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
  var username = req.body.username.toLowerCase();

  checkUserExists(username, function(existsResponse) {
    if (existsResponse === false) {
      console.log("No user exists")
      createPlayer(username, ip);
      createLobby(username, ip, function(code) {
        console.log("Code: " + code)
        res.redirect("/game?username=" + username + "&lobbycode=" + code);
      });
    }
    else {
      console.log("User already exists, can't create lobby")
      res.redirect("/");
    }
  });

});

//Serve cards page
app.get('/cards', function(req, res){
  var cards = masterDeck;
  res.render("cardview", {cards:cards})
});

//Serve index page
app.get('/cards/new', function(req, res){
  res.render("cardcreate")
});

app.post("/cards", function(req,res) {
  console.log(req.body.text)
  var newCard = new Card({
    text: req.body.text,
    type: req.body.type
  });
  newCard.save(function(err, saved) {
    if(err){
      console.log("Problem saving to database");
      console.log(err.message)
    }
    else {
      console.log(saved + " was saved to the database")
    }
  });
  res.redirect("/cards")
});

////////////////////////////////////////////////SOCKET.IO SECTION/////////////////////////////////////////

//Once a socket has connected
io.on('connection', function (socket) {
  console.log("user has connected: " + socket.id)

  socket.on("newUser", function(data) {
    
    //Setup variables for game
    socket.username = data.username;
    socket.lobbycode = data.lobbycode;

    lobbyList[socket.lobbycode][socket.username] = socket.id;
    id = lobbyList[socket.lobbycode][socket.username]
    console.log("Socket ID :" + lobbyList[socket.lobbycode][socket.username])
    console.log("Socket Username: " + socket.username);
    console.log("Socket LobbyCode: " + socket.lobbycode)
  })

  //User has tried connect to room => data.room
  socket.on("connect to room", function(data){
    console.log('User trying to connect to room ' + data.room);
    //Join specified room
    socket.join(data.room);
    //Transmit to the client they are connected to specified room
    io.to(data.room).emit("connectedRoom", { room: data.room, socket: socket.id});
  });

  socket.on("Start game", function() {
    console.log("Game started in room: " + socket.lobbycode + " by " + socket.username)

    setupDecks(socket);
  })

  socket.on("retrieve hand", function() {
    console.log("Attempting to retrieve deck");
    console.log("player hand :" + lobbyList[socket.lobbycode].hands[socket.username])
    if(lobbyList[socket.lobbycode].hands[socket.username].length > 0) {
      console.log("Hand found! : " + lobbyList[socket.lobbycode].hands[socket.username]);
      io.to(lobbyList[socket.lobbycode][socket.username]).emit("send back hand", {hand: lobbyList[socket.lobbycode].hands[socket.username]})
    }
    else {
      console.log("No hand found")
    }
  })

  //When a client tries to broadcast a messge to their room
  socket.on("room message", function(data){
    console.log(data);
    io.to(socket.lobbycode).emit("recievedmessage", { message: data.message});
  });

  socket.on('disconnect', function () {
    var connectionMessage = socket.username + " Disconnected from Socket " + socket.id;
    console.log(connectionMessage);
    removePlayer(socket.username);
    // removeFromServer(socket.username, socket.lobbycode);
    checkForEmptyServer(socket.lobbycode);
  });
});


////////////////////////////////////////////////////Start Server + Catch All/////////////////////////////////////////
app.get("*", function(req,res) {
  res.send("Error, page not found");
})

http.listen(3000 ,function(){
  console.log('listening on *:3000');
});

///////////////////////////////////////////////////Functions/////////////////////////////////////////



/////////////////////////////////////////////////Object Creation//////////////////////////////////////////
function checkUserExists(username, callback) {
  var response = playerList.includes(username)
  console.log("playerList " + playerList)
  console.log("Response " + response)
  callback(response)
}

function createPlayer(username, ip) {
  var player = {
    username: username,
    ip: ip
  }
  playerList.push(player)
  console.log("Playerlist = " + playerList)
}

//Create a lobby object with given username and ip and store it in the database
function createLobby(username, ip, callback) {
  //Create a new lobby
  generateLobbyCode(function(code) {

    var newLobby = {
        ServerName: username + "'s lobby",
        players: [username],
        hands: {}
    }
    newLobby.hands[username] = [];
    lobbyList[code] = newLobby;

    console.log(lobbyList[code])
    callback(code);
  })
}

function generateLobbyCode(callback) {
  var code = Math.floor(100000 + Math.random() * 900000);
  callback(code);
}

//////////////////////////////////////////////Game logic/////////////////////////////////////////////////////

function setupDecks(socket) {
  console.log(lobbyList[socket.lobbycode].players)
    for (var i = 0; i < lobbyList[socket.lobbycode].players.length; i++) {
      var currentPlayers = lobbyList[socket.lobbycode].players
      var temp = [];
      
      //load the white cards
      for (var j = 0; j < 4; j++) {
        var item = masterDeck.White[Math.floor(Math.random() * masterDeck.White.length)];
        temp.push(item);
      }
      
      //Load the red cards
      for (var j = 0; j < 3; j++) {
        var item = masterDeck.Red[Math.floor(Math.random() * masterDeck.Red.length)];
        temp.push(item);
      }

      lobbyList[socket.lobbycode].hands[currentPlayers[i]].push(temp);
    io.to(lobbyList[socket.lobbycode][currentPlayers[i]]).emit('deck', {hand: lobbyList[socket.lobbycode].hands[currentPlayers[i]]});
    }
}


//////////////////////////////////////////////Server exit///////////////////////////////////////////////////
function removePlayer(username) {
  for (var i = 0; i < playerList.length; i++) {
    if (playerList[i].username === username) {
      playerList.splice(i,1)
      console.log("playerlist: " + playerList)
    }
  }
}

function removeFromServer(username,lobbycode) {
  console.log("removing: " + username)

  for (var i = 0; i < Object.keys(lobbyList); i++) {
    if(lobbyList[lobbycode].players[i] === username) {
      lobbyList[lobbycode].players.splice(i,1)
      console.log("lobbylist: " + lobbyList)
    }
  }
}

function checkForEmptyServer(lobbycode) {
    for (var i = 0; i < Object.keys(lobbyList); i++) {
      if (lobbyList[lobbycode].players.length === 0) {
        delete lobbyList[lobbycode];
      }
    }

}

function addToLobby(username,gameCode) {
  if (lobbyList[gameCode]) {
    lobbyList[gameCode].players.push(username);
    lobbyList[gameCode].hands[username] = [];
    console.log("Current Lobby = " + lobbyList[gameCode].players);
  }
  else {
    console.log("Lobby does not exitst");
  }

}



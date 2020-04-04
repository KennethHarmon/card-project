///////////////////////////REQUIRES/////////////////////////////////

var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var bodyParser = require("body-parser");
const maindeck = require("./cards.json")

app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static("public"));
app.set("view engine", "ejs");

///////////////////////////////////////////Server Variables/////////////////////////////////////
var playerList = [];
var lobbyList = {};

var masterDeck = maindeck;

////////////////////////////////////////////PAGE ROUTES////////////////////////////////////////

//Serve index page
app.get('/', function(req, res){
  res.render("index")
});

//Serve game page
app.get("/game", function(req,res) {
  res.render("game", {username: req.query.username, lobbycode: req.query.lobbycode})
})

//Join Game
app.post("/game/join", function(req,res) {
  var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
  var username = req.body.username.trim().toLowerCase();
  var gameCode = req.body.gameCode;

  console.log(username, " is joining game: " + gameCode);

  var doesExist = checkUserExists(username);
  if (doesExist) {
    console.log("User already exists, can't join lobby")
    res.redirect("/");
  }
  else {
    console.log("No user exists")
    createPlayer(username, ip);
    addToLobby(username,gameCode);
    res.redirect("/game?username=" + username + "&lobbycode=" + gameCode);
  };
})

//Create a new game
app.post('/game/new', function(req, res){
  var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
  var username = req.body.username.toLowerCase();

  var doesExist = checkUserExists(username);
  if (doesExist) {
    console.log("User already exists, can't create lobby")
    res.redirect("/");
  }
  else {
    console.log("No user exists")
    createPlayer(username, ip);
    createLobby(username, ip, function(code) {
      console.log("Code: " + code)
      res.redirect("/game?username=" + username + "&lobbycode=" + code);
    });
  }
});

//Serve cards page
app.get('/cards', function(req, res){
  var cards = masterDeck;
  res.render("cardview", {cards:cards})
});

////////////////////////////////////////////////SOCKET.IO SECTION/////////////////////////////////////////

//Once a socket has connected
io.on('connection', function (socket) {
  console.log("user has connected: " + socket.id);
  
  socket.on("newUser", function(data) {
    //Setup players socket variabless
    socket.username = data.username;
    socket.lobbycode = data.lobbycode;

    //Add Id to lobbyList under players username
    lobbyList[socket.lobbycode][socket.username] = socket.id;

    //Add the player to the room only if they're listed in the players for that room
    if (lobbyList[socket.lobbycode].players.includes(socket.username)){
      console.log("Adding: " + socket.username + " to: " + socket.lobbycode);
      socket.join(socket.lobbycode);
      io.to(socket.lobbycode).emit("connectedRoom", { room: data.room, players: lobbyList[socket.lobbycode].players});
    }

    console.log("Socket ID :" + socket.id);
    console.log("Socket Username: " + socket.username);
    console.log("Socket LobbyCode: " + socket.lobbycode);
  });

  socket.on("Start game", () => {
    console.log("Game started in room: " + socket.lobbycode + " by " + socket.username)

    setupDecks(socket,4,3);
    chooseRandomSingle(socket);
    io.to(socket.lobbycode).emit("game started");
  });

  socket.on("send hand", function(data) {
    let username = socket.username;
    let lobbycode = socket.lobbycode;
    let currentPlayersHand = lobbyList[lobbycode].hands[username]

    console.log("Hand recieved: " + data.selectedcards)
    console.log("PLayers: 122421 " + JSON.stringify(lobbyList[lobbycode].players));

    var tempPlayerList = [];
      lobbyList[lobbycode].players.forEach(element => {
      tempPlayerList.push(element);
    }); 
    console.log("Temp player List: " + JSON.stringify(tempPlayerList));

    var singleIndex = tempPlayerList.indexOf(lobbyList[lobbycode].single);
    tempPlayerList.splice(singleIndex, 1);

    //Remove matching cards from the players hands
    for(let i = 0; i < currentPlayersHand.length; i++) {
      if(data.selectedcards[0].text === currentPlayersHand[i].text){
        lobbyList[lobbycode].hands[username].splice(i, 1);
      };
      
      if(data.selectedcards[1]){
        if(data.selectedcards[1].text == currentPlayersHand[i].text) {
          lobbyList[lobbycode].hands[username].splice(i, 1);
        }
      };
    };

    //If the data contains red cards, shuffle them to another persons hand
    if(data.selectedcards[0].type === "red") {
      var currentPlayerIndex = tempPlayerList.indexOf(username);

      if(currentPlayerIndex === (tempPlayerList.length -1)) {
        currentPlayerIndex = 0;
      }
      else {
        currentPlayerIndex++;
      }

      lobbyList[lobbycode].handsInPlay[tempPlayerList[currentPlayerIndex]] = data.selectedcards;
    }
    //If its just white cards it can just be pushed to the corresponding username
    else {
      lobbyList[lobbycode].handsInPlay[username] = data.selectedcards;
    };

    checkNextRound(lobbycode);
  });

  socket.on("start new round", function(data) {
    console.log("Round winner: " + data.winner);
    startNewRound(socket,2,1,data.winner);
  });

  socket.on("chat message", function(msg){
    io.to(socket.lobbycode).emit("chat message", msg);
  });

  socket.on('disconnect', function () {
    var connectionMessage = socket.username + " Disconnected from Socket " + socket.id;
    console.log(connectionMessage);
    removePlayer(socket.username);
    removeFromServer(socket.username,socket.lobbycode);
    checkForEmptyServer(socket.lobbycode);
  });
});


////////////////////////////////////////////////////Start Server + Catch All/////////////////////////////////////////
app.get("*", function(req,res) {
  res.send("Error, page not found");
})

http.listen(3024 ,function(){
  console.log('listening on *:3024');
});

///////////////////////////////////////////////////Functions/////////////////////////////////////////



/////////////////////////////////////////////////Object Creation + Player adding//////////////////////////////////////////
function checkUserExists(username) {
  var response = playerList.includes(username)
  console.log("playerList " + playerList)
  console.log("Response " + response)
  return response
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
        hands: {},
        handsInPlay : {}
    }
    newLobby.hands[username] = [];
    lobbyList[code] = newLobby;

    console.log(lobbyList[code])
    callback(code);
  })
};

function addToLobby(username,gameCode) {
  if (lobbyList[gameCode]) {
    lobbyList[gameCode].players.push(username);
    lobbyList[gameCode].hands[username] = [];
    console.log("Current Lobby = " + lobbyList[gameCode].players);
  }
  else {
    console.log("Lobby does not exitst");
  }
};

function generateLobbyCode(callback) {
  var code = Math.floor(100000 + Math.random() * 900000);
  callback(code);
};

//////////////////////////////////////////////Game logic/////////////////////////////////////////////////////

function setupDecks(socket,white,red) {
  console.log(lobbyList[socket.lobbycode].players)
    for (var i = 0; i < lobbyList[socket.lobbycode].players.length; i++) {
      var currentPlayers = lobbyList[socket.lobbycode].players
      var temp = [];
      
      //load the white cards
      for (var j = 0; j < white; j++) {
        var item = masterDeck.White[Math.floor(Math.random() * masterDeck.White.length)];
        temp.push(item);
      }
      
      //Load the red cards
      for (var j = 0; j < red; j++) {
        var item = masterDeck.Red[Math.floor(Math.random() * masterDeck.Red.length)];
        temp.push(item);
      }

      if(lobbyList[socket.lobbycode].players[i] === lobbyList[socket.lobbycode].single) {
        console.log("Not sending deck to the single");
      }
      else {
        for(let j = 0; j < temp.length; j++){
          lobbyList[socket.lobbycode].hands[currentPlayers[i]].push(temp[j])
        }
      }
    io.to(lobbyList[socket.lobbycode][currentPlayers[i]]).emit('deck', {hand: lobbyList[socket.lobbycode].hands[currentPlayers[i]], players: lobbyList[socket.lobbycode].players});
    }
}

function chooseRandomSingle(socket) {
  console.log("CHOOSESINGLE")
  var single = lobbyList[socket.lobbycode].players[Math.floor(Math.random() * lobbyList[socket.lobbycode].players.length)];
  var id = lobbyList[socket.lobbycode][single];
  console.log("Single = " + single);
  console.log("ID = " + id);
  
  lobbyList[socket.lobbycode].single = single;

  io.to(id).emit("Youre single");
  io.to(socket.lobbycode).emit("single is", {single: single});
  console.log("ACtual single : " + lobbyList[socket.lobbycode].single)
}

function chooseNewSingle(socket) {
  console.log("CHOOSE NEW SINGLE")
  console.log("Players list: " + lobbyList[socket.lobbycode].players)
  console.log("Current single: " + lobbyList[socket.lobbycode].single)
  var currentSingleIndex = lobbyList[socket.lobbycode].players.indexOf(lobbyList[socket.lobbycode].single);
  console.log("Current single index : " + currentSingleIndex);
  if (currentSingleIndex === (lobbyList[socket.lobbycode].players.length -1)) {
    console.log("Resetting single index");
    currentSingleIndex = 0;
  }
  else {
    currentSingleIndex++;
    console.log("New single index = "+ currentSingleIndex);
  } 

  var single = lobbyList[socket.lobbycode].players[currentSingleIndex];
  var id = lobbyList[socket.lobbycode][single];
  console.log("Single = " + single);
  console.log("ID = " + id);
  
  lobbyList[socket.lobbycode].single = single;

  io.to(id).emit("Youre single");
  io.to(socket.lobbycode).emit("single is", {single: single});
  console.log("ACtual single : " + lobbyList[socket.lobbycode].single)
};

function checkNextRound(lobbycode) {
  if(Object.keys(lobbyList[lobbycode].handsInPlay).length === (lobbyList[lobbycode].players.length - 1)){
    var cardTotal = 0;
    for(let i = 0; i < lobbyList[lobbycode].players.length; i++){
      var name = lobbyList[lobbycode].players[i];
      if(lobbyList[lobbycode].handsInPlay[name]){
        cardTotal += lobbyList[lobbycode].handsInPlay[name].length;
      }
    }
    var division = (cardTotal/((lobbyList[lobbycode].players.length)-1));
    if(division === 2 || division === 1  ) {
      io.to(lobbycode).emit("next stage", {hands: lobbyList[lobbycode].handsInPlay})
    }
  }
};

function startNewRound(socket,white,red,winner) {
  io.to(socket.lobbycode).emit("clear singles");
  lobbyList[socket.lobbycode].handsInPlay = {};
  console.log("SINGLE: " + lobbyList[socket.lobbycode].single);
  setupDecks(socket,white,red);
  chooseNewSingle(socket);
  io.to(socket.lobbycode).emit("new round started", {winner: winner, players: lobbyList[socket.lobbycode].players});
};

//////////////////////////////////////////////Server exit///////////////////////////////////////////////////
function removePlayer(username) {
  for (var i = 0; i < playerList.length; i++) {
    if (playerList[i].username === username) {
      playerList.splice(i,1)
      console.log("playerlist: " + playerList)
    }
  }
};

function removeFromServer(username,lobbycode) {
  if(lobbyList[lobbycode]){
    lobbyList[lobbycode].players.forEach(function(element,index) {
      if(username === element){
        lobbyList[lobbycode].players.splice(index, 1);
        delete lobbyList[lobbycode].hands[username];
        delete lobbyList[lobbycode][username];
      };
    });
  };
  console.log("Server = " + JSON.stringify(lobbyList[lobbycode]));
};

function checkForEmptyServer(lobbycode) {
  if(lobbyList[lobbycode]){
    if (lobbyList[lobbycode].players.length === 0) {
      delete lobbyList[lobbycode];
    };
  }
};




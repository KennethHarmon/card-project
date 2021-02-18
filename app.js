///////////////////////////SETUP/////////////////////////////////

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bodyParser = require("body-parser");
const maindeck = require("./cards.json");
const gameController  = require("./controllers/game.js");
const socketHandler = require("./socketHandler.js")(io);
const Lobby = require("./models/lobby.js")

app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static("public"));
app.set("view engine", "ejs");

mongoose.connect('mongodb://localhost:27017/cardgame', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

const db = mongoose.connection;
db.once("open", () => {
    console.log("Database connected");
});

////////////////////////////////////////////PAGE ROUTES////////////////////////////////////////

//Serve index page
app.get('/', gameController.index);

//Serve game page
app.get("/game", gameController.game)

//Join Game
app.post("/game/join", gameController.join);

//Create a new game
app.post('/game/new', gameController.create);

//Serve cards page
app.get('/cards', gameController.cards);

////////////////////////////////////////////////SOCKET.IO SECTION/////////////////////////////////////////

//Once a socket has connected
io.on('connection', function (socket) {
  console.log("user has connected: " + socket.id);
  
  socket.on("newUser",  async function(data) {
    socket.username = data.username;
    socket.lobbycode = data.lobbycode;

    const lobby = await Lobby.findOne({ lobbyCode: socket.lobbycode}).populate({path: "players"});
    var isInLobby = false;
    var playerList = [];

    lobby.players.forEach(player => {
        playerList.push(player.username);
        if (player.username == socket.username) {
          player.socketid = socket.id;
          isInLobby = true;
        }
        player.save();
    });

    if(isInLobby){ 
        console.log("Adding: " + socket.username + " to: " + socket.lobbycode);
        socket.join(socket.lobbycode);
        io.to(socket.lobbycode).emit("connectedRoom", { room: data.room, players: playerList,username:socket.username});
    }
    else {
      console.log("User has been disconnected");
      io.to(socket.username).emit("chat message", {sender: "GAME", msg: "Error, user disconnected, please return to the homepage and rejoin"})
    }
  });

  socket.on("Start game", socketHandler.startGame);

  socket.on("send hand", socketHandler.sendHand);

  socket.on("start new round", socketHandler.startRound);

  socket.on("restart round", socketHandler.restartRound);

  socket.on("chat message", socketHandler.chatMsg);

  socket.on('disconnect', socketHandler.disconnect);
});

////////////////////////////////////////////////////Start Server + Catch All/////////////////////////////////////////
app.get("*", function(req,res) {
  res.send("Error, page not found");
})

http.listen(3024 ,function(){
  console.log('listening on *:3024');
});





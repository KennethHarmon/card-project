const Lobby = require("./models/lobby.js");
const { White, Red } = require("./cards.json");
const Player = require("./models/player.js");
const lobby = require("./models/lobby.js");

module.exports = (io) => {
    const startGame = async function(scoreLimit){
        const socket = this;
        const lobby = await Lobby.findOne({ lobbyCode: socket.lobbycode}).populate({path: "players"});
        if(lobby){
          console.log("Game started in room: " + socket.lobbycode + " by " + socket.username)
          lobby.scoreLimit = scoreLimit;
          lobby.gameStarted = true;
          let playerList = [];
          lobby.players.forEach(player => {
            playerList.push(player.username);
          })
          lobby.playerList = playerList;
          await setupDecks(socket,lobby,4,3);
          chooseRandomSingle(socket, lobby);
          io.to(socket.lobbycode).emit("scorelimit",scoreLimit);
          io.to(socket.lobbycode).emit("game started");
        }
        else{
          io.to(socket.lobbycode).emit("chat message", {sender: "GAME", msg: "Error, lobby no longer exists, please make a new game from the <a href='/'>homepage</a>"})
        }
    };

    const sendHand = async function(data) {
        const socket = this;
        let username = socket.username;
        let lobbycode = socket.lobbycode;
        const lobby = await Lobby.findOne({lobbyCode: lobbycode}).populate({path: "players"});
        let currentPlayersHand;
        var tempObj = {};
    
        console.log("Hand recieved: " + data.selectedcards)
        console.log("PLayers: " + JSON.stringify(lobby.players));
    
        var tempPlayerList = [];
          lobby.players.forEach(player => {
          tempPlayerList.push(player.username);
          if (player.username == socket.username) {
              currentPlayersHand = player.hand;
          }
        }); 
        console.log("Temp player List: " + JSON.stringify(tempPlayerList));
    
        var singleIndex = tempPlayerList.indexOf(lobby.single);
        tempPlayerList.splice(singleIndex, 1);
    
        //Remove matching cards from the players hands
        for(let i = 0; i < currentPlayersHand.length; i++) {
          if(data.selectedcards[0].text === currentPlayersHand[i].text){
            currentPlayersHand.splice(i, 1);
          };
          
          if(data.selectedcards[1]){
            if(data.selectedcards[1].text == currentPlayersHand[i].text) {
              currentPlayersHand.splice(i, 1);
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
          
          tempObj[tempPlayerList[currentPlayerIndex]] = data.selectedcards;
          lobby.handsInPlay[currentPlayerIndex].push(tempObj);
        }
        //If its just white cards it can just be pushed to the corresponding username
        else {
            tempObj[username] = data.selectedcards;
            lobby.handsInPlay.push(tempObj);
        };
        
        await lobby.save();
        checkNextRound(lobbycode,lobby);
    };

    const startRound = function(data) {
        const socket = this;
        if(data){
          console.log("Round winner: " + data.winner);
          startNewRound(socket,2,1,data.winner);
        } 
        else {
          startNewRound(socket,2,1);
        }
    };

    const restartRound = async function(data){
        const socket = this;
        const lobby = Lobby.findOne({lobbyCode: socket.lobbycode});
        if(lobby.restarts === lobby.disconnects){
          console.log("Not repeating restart");
        } 
        else {
          startNewRound(socket,data.whites,0);
          lobby.restarts++;
        }
        await Lobby.save();
    };

    const chatMsg = function(msg){
        const socket = this;
        io.to(socket.lobbycode).emit("chat message", {sender: socket.username, msg: msg});
    };

    const disconnect = async function () {
        const socket = this;
        var connectionMessage = socket.username + " Disconnected from Socket " + socket.id;
        const lobby = await Lobby.findOne({ lobbyCode: socket.lobbycode}).populate({path: "players"});

        console.log(connectionMessage);
        removePlayer(socket.username, lobby);
        checkForInvalidServer(lobby);
        checkForEmptyServer(lobby);
        if(lobby){
          lobby.disconnects++;
          io.to(socket.lobbycode).emit("player disconnected", {username: socket.username, players: lobby.playerList});
        }
    };

    /////////////////////////////////////////////////Game logic Functions//////////////////////////////////////////
    const setupDecks = async function (socket, lobby, white, red) {
        var playerList = [];
        
        lobby.players.forEach(player => {
            var temp = [];
            playerList.push(player.username);

            //load the white cards
            for (var j = 0; j < white; j++) {
                var item = White[Math.floor(Math.random() * White.length)];
                temp.push(item);
            }

            //Load the red cards
            for (var j = 0; j < red; j++) {
                var item = Red[Math.floor(Math.random() * Red.length)];
                temp.push(item);
            }

            if (player.username === lobby.single) {
                console.log("Not sending deck to the single");
            }
            else {
                for (let j = 0; j < temp.length; j++) {
                    player.hand.push(temp[j])
                }
            }
            player.save();
            io.to(player.socketid).emit('deck', { hand: player.hand, players: playerList});
        });
        await lobby.save();
    };

    const chooseRandomSingle = function (socket, lobby) {
        console.log("CHOOSESINGLE")
        var single = lobby.players[Math.floor(Math.random() * lobby.players.length)];
        var id = single.socketid;

        lobby.single = single.username;

        io.to(id).emit("Youre single");
        io.to(socket.lobbycode).emit("single is", { single: single.username });
    }

    const chooseNewSingle = function (socket) {
        console.log("CHOOSE NEW SINGLE")
        var currentSingleIndex = lobbyList[socket.lobbycode].players.indexOf(lobbyList[socket.lobbycode].single);
        if (currentSingleIndex === (lobbyList[socket.lobbycode].players.length - 1)) {
            currentSingleIndex = 0;
        }
        else {
            currentSingleIndex++;
        }

        var single = lobbyList[socket.lobbycode].players[currentSingleIndex];
        var id = lobbyList[socket.lobbycode][single];

        lobbyList[socket.lobbycode].single = single;

        io.to(id).emit("Youre single");
        io.to(socket.lobbycode).emit("single is", { single: single });
    };

    const checkNextRound = function (lobbycode, lobby) {
        if (Object.keys(lobby.handsInPlay).length === (lobby.players.length - 1)) {
            var cardTotal = 0;
            for (let i = 0; i < lobby.players.length - 1; i++) {
                var name = lobby.players[i].username;
                console.log("Name: " + name);
                console.log("Handsinplay[i]" + lobby.handsInPlay[i]);
                var keys = Object.keys(lobby.handsInPlay[i]);
                if (keys[0] === name) {
                    cardTotal += lobby.handsInPlay[i][name].length;
                }
            }
            var division = (cardTotal / ((lobby.players.length) - 1));
            if (division === 2) {
                io.to(lobbycode).emit("finished white stage", { hands: lobby.handsInPlay });
            }
            else if (division === 1) {
                io.to(lobbycode).emit("finished red stage", { hands: lobby.handsInPlay });
            }
        }
    };

    const startNewRound = async function (socket, white, red, winner) {
        io.to(socket.lobbycode).emit("clear singles");
        const lobby = await Lobby.findOne({lobbyCode: socket.lobbycode});
        lobby.handsInPlay = {};
        console.log("SINGLE: " + lobbyList[socket.lobbycode].single);
        setupDecks(socket, lobby, white, red);
        chooseNewSingle(socket);
        io.to(socket.lobbycode).emit("new round started", { winner: winner, players: lobby.playerList });
    };

    //////////////////////////////////////////////Server exit///////////////////////////////////////////////////
    const removePlayer = async function (username, lobby) {
        console.log("removing player")
        var id = "";
        lobby.players.forEach(player => {
            if (player.username === username) {
                id = player._id;
            }
        });
        console.log("ID: " + id);
        await Player.findByIdAndDelete(id);
        //TODO Remove player references from lobby.
    };

    const checkForEmptyServer = function (lobby) {
        if (lobby) {
            if (lobby.players.length === 0) {
                Lobby.findByIdAndDelete(lobby._id);
            };
        }
    };

    const checkForInvalidServer = async function (lobby) {
        if (lobby) {
            if ((lobby.players.length < 3) && (lobby.gameStarted === true)) {
                for (let i = 0; i < lobby.players.length; i++) {
                    lobby.players[i].hand = [];
                };
                lobby.gameStarted = false;
                await lobby.save();
                console.log("ERROR, too few in lobby");
                io.to(lobby.lobbyCode).emit("invalid lobby");
            }
        }
    };

    return {
        startGame,
        sendHand,
        startRound,
        restartRound,
        chatMsg,
        disconnect
    }
}
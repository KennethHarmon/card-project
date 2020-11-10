# Card Project (Red Flags online)

## Introduction / Background
This project started out as a personal hobby looking for something to do with my friends during the covid-19 outbreak. I had gotten into playing a few card games with my friends and wanted to recreate something similar that we could play online and not have to meet each other inn person. I initally decided to recreate a game called red flags since it had fairly simple rules and I felt I could recreate it but I am definitely going to use everything I learned during this project to recreate other games in the future and expand upon it.

## Technologies
This project is built on Node.js using socket.io to coordinate realtime gameplay. The interface is just basic html and css that I created myself from scratch (I'm no designer) and I'm using bootstrap to more easily make it responsive. I'm pretty happy with how it looks on different screen sizes. 

## Gameplay
The gameplay is pretty straightforward and uses the same rules as the card game. Just create a lobby and a code will be generated which you can give to other users to join. A randomly selected single person is chosen and the others have to try and create the best date for them using their available white cards. However once the white cards are played you each choose a red card to sabotage your opponents and make your date seem (relatively) better.

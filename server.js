//Final Project
//Set up code when the server first starts up
const pg = require("pg");
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require('cors')

const app = express();
const port = 8080;

const hostname = "localhost";

const saltRounds = 10;

const env = require("../env.json");

//base stats
let baseHealth = 100;
let baseDefense = 0;
let baseAttack = 2;
let baseSpeed = 10;
let baseInventory = '[]';
let activeStats;
//let activeStats = {"username": 'masen3', "health": 100, "attack": 2, "defense": 0, "speed": 10, "inventory": '[]'};

//Connect to the database
const Pool = pg.Pool;
const pool = new Pool(env);
pool.connect().then(function () {
    console.log(`Connected to database ${env.database}`);
});

app.use(express.json());
app.use(express.static("public"));
app.use(cors());
//Post funtion to add a user to the database
app.post("/signup", function (req, res) {


    let username = req.body.username;
    let plaintextPassword = req.body.plaintextPassword;

	//If statement to check if the Username and Password is in the correct format
	if (!req.body.hasOwnProperty("username") ||
        !req.body.hasOwnProperty("plaintextPassword") ||
		!isNaN(username) ||
		!isNaN(plaintextPassword) ||
		username.length < 1 ||
		username.length > 20 ||
		plaintextPassword.length < 5 ||
		plaintextPassword.length > 36
	){

		res.status(401).json({"error" : "Username or Password is doesn't have the expected format"});

	} else{
		//Pulling the usernames from the database
		pool.query("SELECT username FROM users WHERE username = $1", [
			username,
		])
			.then(function (response) {
				//If statement to check if there are usernames in the database
				if (response.rows.length !== 0) {
					let usernameOld = response.rows[0].username;
					//If statement to check if the username already exist
					if (username === usernameOld) {
						res.status(401).json({"error": "Username already exists"});
					}
				} else{
					//Function to incript the users password and save it to the database
					bcrypt
						.hash(plaintextPassword, saltRounds)
						.then(function (hashedPassword) {
							pool.query(

								"INSERT INTO users (username, password) VALUES ($1, $2)",
								[username, hashedPassword]
							)
								.then(function (response) {
									pool.query(
										"INSERT INTO stats (username, health, attack, defense, speed, inventory) VALUES ($1, $2, $3, $4, $5, $6)",
										[username, baseHealth, baseAttack, baseDefense, baseSpeed, baseInventory]
									)
										.then(function (response) {
											//account and base stats successfully created
											activeUser = username;
											res.status(200).json({"success": "Account Creation Successful, Now Log In To Access Valley.txt"});

										})
										.catch(function (error) {
											console.log(error);
											res.status(500).json({"error": "Internal Server Error"}); // server error
										});
								})
								.catch(function (error) {
									console.log(error);
									res.status(500).json({"error": "Internal Server Error"}); // server error
								});
						})
						.catch(function (error) {
							console.log(error);
							res.status(500).json({"error": "Internal Server Error"}); // server error
						});

				}
			});
	}
});


app.post("/signin", function (req, res) {
    let username = req.body.username;
    let plaintextPassword = req.body.plaintextPassword;
	//Pulling the usernames from the database
    pool.query("SELECT password FROM users WHERE username = $1", [
        username,
    ])
        .then(function (response) {
			//Check if the username doesn't exist
            if (response.rows.length === 0) {
                return res.status(401).json({"error": "Username doesn't exist"});
            }
            let hashedPassword = response.rows[0].password;

            //Funtion to check if the Passwords match
			bcrypt.compare(plaintextPassword, hashedPassword)
                .then(function (isSame) {
                    if (isSame) {
                        // password matched
						pool.query("SELECT * FROM stats WHERE username = $1", [
							username,
						])
							.then(function (response) {
								activeStats = {"username": username, "health": response.rows[0].health, "attack": response.rows[0].attack, "defense": response.rows[0].defense, "speed": response.rows[0].speed, "inventory": response.rows[0].inventory};
								console.log(activeStats);
								res.status(200).send({"username": username,"token": true});
							})
							.catch(function (error) {
								console.log(error);
								res.status(500).json({"error": "Internal Server Error"}); // server error
							});
                    } else {
                        // password didn't match
                        res.status(401).json({"error": "Incorrect password"});
                    }
                })
                .catch(function (error) {
                    console.log(error);
                    res.status(500).json({"error": "Internal Server Error"}); // server error
                });
        })
        .catch(function (error) {
            console.log(error);
            res.status(500).json({"error": "Internal Server Error"}); // server error
        });

});

app.post("/collect", function (req, res) {
  let item = req.body;
  //console.log(item);
  addItem(item);
  updateData();
  //console.log(activeStats);
  //console.log(activeStats.inventory);
});

app.post("/craft", function (req, res) {
  let item = req.body;
  removeItem(item);
  updateData();
});

app.post("/equip", function (req, res) {

});

app.get("/stats", function (req, res){
  res.json(activeStats);
});

app.post("/setStats", function (req, res){
    activeStats = req.body;
	updateData();
});

app.get("/cave", function (req, res){
  monsters=['Goblin','Witch','Skeleton','Dragon']


  deter = Math.floor(Math.random() * 9)

  if(deter <= 2){
    res.json({battle : false, ore: "Iron"})
  }
  else{
    res.json({battle : true, monster : monsters[Math.floor(Math.random() * 4)], health: 100, attack : Math.floor(Math.random() * 60), defense : Math.floor(Math.random() * 60), speed : Math.floor(Math.random() * 60)})
  }

	// random number to find if fight or mine, if fight generate enemy stats, if mine random number to choose what resorce, send boolean (under key {"battle": true or false} from random number and enemy stats or minable resorce.
});

app.listen(8080, () => {
    console.log('Listening on port 8080')
});

function updateData(){
	pool.query("UPDATE stats SET health = $1, attack = $2, defense = $3, speed = $4, inventory = $5 WHERE username = $6", [
        activeStats.health, activeStats.attack, activeStats.defense, activeStats.speed, activeStats.inventory, activeStats.username,
    ]).then(function (response) {
		console.log("Database updated");
	}).catch(function (error) {
		console.log(error);
	});
}

function addItem(item){
	let itemName = item.item;
	let itemCheck = 0;
	let tempInv = JSON.parse(activeStats.inventory);
	for (let x = 0; x < tempInv.length; x++){
		if (tempInv[x].item == itemName){
			tempInv[x].quantity += 1;
			itemCheck = 1;
			activeStats.inventory = JSON.stringify(tempInv);
		}
	}
	if (itemCheck === 0){
		tempInv.push(item);
		activeStats.inventory = JSON.stringify(tempInv);
	}
}

function removeItem(item){
	let itemName = item.item;
	let itemCheck = 0;
	let tempInv = JSON.parse(activeStats.inventory);
	for (let x = 0; x < tempInv.length; x++){
		if (tempInv[x].item == itemName){
			tempInv[x].quantity -= 1;
			itemCheck = 1;
			if (tempInv[x].quantity === 0){
				delete tempInv[x];
			activeStats.inventory = JSON.stringify(tempInv);
		}
	}
}

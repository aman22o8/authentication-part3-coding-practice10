const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3009, () => {
      console.log("SERVER IS RUNNING AT http://localhost/:3009");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const authorizationTokens = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//getting all user
app.get("/users/", async (resquest, response) => {
  const gettingalluserQuery = `SELECT * FROM user;`;
  const dbresponse = await db.all(gettingalluserQuery);
  response.send(dbresponse);
});

//register new user
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashPassword = await bcrypt.hash(password, 10);
  const checkinguseravailability = `SELECT * FROM user WHERE username='${username}';`;
  const dbResponse = await db.get(checkinguseravailability);
  if (dbResponse === undefined) {
    const addingnewuser = `INSERT INTO user(username,name,password,gender,location) VALUES('${username}',
    '${name}','${hashPassword}','${gender}','${location}');`;
    const dbResponse = await db.run(addingnewuser);
    response.status(200);
    response.send("user added successfully");
  } else {
    response.status(401);
    response.send("Invalid user");
  }
});

//API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkinguseravailability = `SELECT * FROM user WHERE username='${username}';`;
  const dbresponse = await db.get(checkinguseravailability);
  if (dbresponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbresponse.password
    );
    if (isPasswordMatched === true) {
      let payload = { username: username };

      const jwtToken = await jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2

app.get("/states/", authorizationTokens, async (request, response) => {
  const gettingallStatesQuery = `SELECT * FROM state;`;
  const dbResponse = await db.all(gettingallStatesQuery);
  const convertingtheresult = dbResponse.map((each) => {
    return {
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    };
  });
  response.send(convertingtheresult);
});

//API3

app.get("/states/:stateId/", authorizationTokens, async (request, response) => {
  const { stateId } = request.params;
  //   console.log(request);
  const gettingsateidQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const dbRESPONSE = await db.get(gettingsateidQuery);
  const convertingtheresponse = (dbRESPONSE) => {
    return {
      stateId: dbRESPONSE.state_id,
      stateName: dbRESPONSE.state_name,
      population: dbRESPONSE.population,
    };
  };

  response.send(convertingtheresponse(dbRESPONSE));
});

//API 4
app.post("/districts/", authorizationTokens, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const gettingallDistrictQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) VALUES(
        '${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const dbResponse = await db.run(gettingallDistrictQuery);

  response.send("District Successfully Added");
});

//API5
app.get(
  "/districts/:districtId/",
  authorizationTokens,
  async (request, response) => {
    const { districtId } = request.params;
    const gettingparticulardistrictQuery = `SELECT * FROM district WHERE district_id=${districtId};`;
    const dbRESPONSEE = await db.get(gettingparticulardistrictQuery);
    const convertingtheresponse = (dbRESPONSEE) => {
      return {
        districtId: dbRESPONSEE.district_id,
        districtName: dbRESPONSEE.district_name,
        stateId: dbRESPONSEE.state_id,
        cases: dbRESPONSEE.cases,
        cured: dbRESPONSEE.cured,
        active: dbRESPONSEE.active,
        deaths: dbRESPONSEE.deaths,
      };
    };
    response.send(convertingtheresponse(dbRESPONSEE));
  }
);

//API6
app.delete(
  "/districts/:districtId/",
  authorizationTokens,
  async (request, response) => {
    const { districtId } = request.params;
    const deletequery = `DELETE  FROM district WHERE district_id=${districtId};`;
    await db.run(deletequery);
    response.send("District Removed");
  }
);

//API7
app.put(
  "/districts/:districtId/",
  authorizationTokens,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id=${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API8

app.get(
  "/states/:stateId/stats/",
  authorizationTokens,
  async (request, response) => {
    const { stateId } = request.params;
    const totalstats = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM district WHERE state_id=${stateId};`;
    const dbRESPONSeE = await db.get(totalstats);
    response.send(dbRESPONSeE);
  }
);

module.exports = app;

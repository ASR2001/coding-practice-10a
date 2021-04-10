const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "./covid19India.db");
const app = express();
app.use(express.json());
let db = null;

const convertStateDBToStateObject = (stateDB) => {
  const { state_id, state_name, population } = stateDB;
  return {
    stateId: state_id,
    stateName: state_name,
    population: population,
  };
};
const convertDistrictDBToDistrictObject = (districtDB) => {
  const {
    district_id,
    district_name,
    state_id,
    cases,
    cured,
    active,
    deaths,
  } = districtDB;
  return {
    districtId: district_id,
    districtName: district_name,
    stateId: state_id,
    cases,
    cured,
    active,
    deaths,
  };
};
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running!!");
    });
  } catch (e) {
    console.log(`Error : ${e.message}`);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_STRING", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const findUserQuery = `SELECT * FROM user WHERE username='${username};'`;
  const user = await db.get(findUserQuery);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordsMatched = await bcrypt.compare(password, user.password);
    if (isPasswordsMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_STRING");
      response.send({ jwtToken });
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT 
        *
    FROM
        state`;
  const stateArray = await db.all(getStatesQuery);
  response.send(stateArray.map((state) => convertStateDBToStateObject(state)));
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT
        *
    FROM 
        state
    WHERE 
        state_id=${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(convertStateDBToStateObject(state));
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
    INSERT INTO
        district (district_name,state_id,cases,cured,active,deaths)
    VALUES
        ('${districtName}',${stateId},${cases},${cured},${active},${deaths})`;
  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT
    *
    FROM
    district
    WHERE
    district_id=${districtId};
  `;
    const district = await db.get(getDistrictQuery);
    response.send(convertDistrictDBToDistrictObject(district));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrictQuery = `
    UPDATE district
    SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths}
    WHERE district_id=${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT 
    SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
    FROM
    district
    WHERE
    state_id=${stateId};`;
    const stateStats = await db.get(getStateStatsQuery);
    response.send(stateStats);
  }
);

app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateQuery = `
    SELECT 
    state.state_name as stateName
    FROM
    state join district on state.state_id=district.state_id
    WHERE district_id=${districtId};`;
    const state = await db.get(getStateQuery);
    response.send(state);
  }
);

module.exports = app;

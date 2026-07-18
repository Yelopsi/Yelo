const { getFollowUps } = require('./backend/controllers/adminController');
const res = {
  json: (data) => console.log(JSON.stringify(data, null, 2)),
  status: (code) => ({ json: (err) => console.log("ERROR", code, err) })
};
getFollowUps({}, res);

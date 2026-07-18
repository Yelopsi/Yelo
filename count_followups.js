const { getFollowUps } = require('./backend/controllers/adminController');
const res = {
  json: (data) => {
    const psiFeedbacks = data.filter(d => d.type === 'psi_feedback' && d.status === 'pending');
    console.log("Total psi_feedbacks pending:", psiFeedbacks.length);
    console.log("Feedbacks pending older than 48h:", psiFeedbacks.map(f => f.realId));
    process.exit();
  },
  status: (code) => ({ json: (err) => console.log("ERROR", code, err) })
};
getFollowUps({}, res);

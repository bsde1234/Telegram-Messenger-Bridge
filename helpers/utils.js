module.exports.JSON_log = message => {
    console.log(JSON.stringify(message, null, 4));
};

module.exports.removeEmpty = x => {
    let obj = Object.assign({}, x);
    Object.keys(obj).forEach(key => obj[key] == null && delete obj[key]);
    return obj;
};

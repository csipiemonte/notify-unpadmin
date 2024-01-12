
var crypto = require('crypto');

function encrypt(cleardata,password) {
    var cryptedKey = crypto.createHash('md5').update(password).digest("hex");
    var iv = cryptedKey.slice(0,16);
    var encipher = crypto.createCipheriv('aes-256-cbc', cryptedKey, iv),
        encryptdata = encipher.update(cleardata, 'utf8', 'binary');
    encryptdata += encipher.final('binary');
    var encode_encryptdata = new Buffer(encryptdata, 'binary').toString('base64');
    return encode_encryptdata;
}


function decrypt(encryptdata,password) {
    var cryptedKey = crypto.createHash('md5').update(password).digest("hex")
    var iv = cryptedKey.slice(0,16);

    encryptdata = new Buffer(encryptdata, 'base64').toString('binary');

    var decipher = crypto.createDecipheriv('aes-256-cbc', cryptedKey, iv),
        decoded = decipher.update(encryptdata, 'binary', 'utf8');
    decoded += decipher.final('utf8');
    return decoded;
}

var encoded = encrypt("hello world","test");
console.log(encoded);
encoded = "YF6E7N5muTBWYRkQaLjSIBgQFtCxKObkWnbW0xVd2EW1U9+pKiUi5zyM6lrrKpOFGKXzFk4bvadd/gSTtb1zCBAZpJcWW/1rFu1eZej+CoNmcYOn+AdJOKtTu+RpEOE8BJnttrAfjDwTnxLf5kMd8ptsB2h7dPfSzWNi7/Ggn7uUJ3gMf/b1gC5IhxJPvJpsuCIpMlxejsvoNpzWtOF7xdonaZuQ0Bf2tGDwcrSi8lLwmUhJIqnx7PzHSqiKPtSU7eEZtEZkLnY1+DU/FV6O0nf+qCkPwuXwR9NPcxZ7gBpJuL99VgMbLJjjOuEB88pS7kPM9iXa3dOcCK1gVp/AEE4A+ftqaVhcwzfXHFm0SdVl70+6xCl4IVIecMNzap0Sqe6dXmiDcfSTfpPnSTHjVL+cWpPQjhW1dMj83Jv6nU+glWbzEjHzMH4nWfxJZrSyF63cG/dCPc0JoQxv2suCkPck1G8dXiPKZHRrzgHANkWQkhkFzDFAyWbsDO5BOQ6CQNne6jxTcqJNuj0+gNmHU5SHpMVyXjop6KKYcdl60G3jhHldqniHpJlcoHLO/yq7SCSW7MOSUydhmIeC0hdkTUrNmSbTOpDJ2LozNZiN76zKOeEwkeruDJNcsqmye2knbXZ2B9263vdJnbF4Q601euGcVG4O8niHIQ27EG2flZ79e8YIsNZQ1qTUOj52T0snFhXq2bl1S6n8L/U5PmdPmpmoaY5vurjFJ+RDZH0TfsY3EgJtpHS/sY5ss6rrErey8WMcASEk0+7uHkTiLPPpoiMrN8bH76Nriq3Befwn/YMwNuQcl/GpRLQkWIg1XFFneTUTR3CrnQn5+3I+VrNQf5APj/MbA5wwq+1WjvPau4eR5wIaqLavFv0MUn9eJqsay0z2v9P8HiDj1CBeE6FHdchPEmDOK86Zl8WkIF4hKlE3LXAu5mclGslcgtNz4Llv5kBu3/+Eg4xrvGubf/17zSj9liAuyT20HO2pfV592Oc4Ef46QhFoLOh/qpy04kIubfAxMFFdTpo3iP3TqbI0R1ccU3yr65P+TkpVzeQ5mi/UCjCo9iGBKncp2dmeFD2oPWo8fLfUYpovdLzEoG7pEg=="
var decrypted = decrypt(encoded,"dev");
console.log(decrypted);


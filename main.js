const format = require('string-format');
const jsonfile = require('jsonfile');
const fs = require('fs');

console.log('   ╭──────────────────────────────────────────────╮');
console.log('   │                                              │');
console.log('   │    Telegram Messenger Bridge                 │');
console.log('   │    Forked: github.com/rexx0520/chat-bridge   │');
console.log('   │                                              │');
console.log('   ╰──────────────────────────────────────────────╯');

format.extend(String.prototype, {});
const removeEmpty = x => {
    var obj = Object.assign({}, x);
    Object.keys(obj).forEach(key => obj[key] == null && delete obj[key]);
    return obj;
};

var testMsgrId,
    testTgId,
    groupTgId,
    groupMsgrId,
    debug,
    fbAccount,
    tgUsers,
    tgToken,
    previewTextLimit,
    downloadToBuffer,
    chats,
    lang;

var init = () => {
    if (fs.existsSync('config.json')) {
        jsonfile.readFile('./config.json', (err, obj) => {
            groupMsgrId = exports.groupMsgrId = obj.groupMsgrId;
            messenger = exports.messenger = obj.messenger;
            fbAccount = exports.fbAccount = obj.fbAccount;
            groupTgId = exports.groupTgId = obj.groupTgId;
            tgUsers = exports.tgUsers = obj.tgUsers;
            tgToken = exports.tgToken = obj.tgToken;
            telegram = exports.telegram = obj.telegram;
            debug = exports.debug = obj.debug;
            previewTextLimit = exports.previewTextLimit = obj.previewTextLimit;
            downloadToBuffer = exports.downloadToBuffer = obj.downloadToBuffer;
            lang = exports.lang = fs.existsSync(
                './lang/{}.json'.format(obj.lang)
            )
                ? require('./lang/{}.json'.format(obj.lang))
                : require('./lang/{}.json'.format('en-US'));

            console.log('DEBUG = ' + debug.toString());
            console.log('Messenger: ' + messenger.toString());
            console.log('Telegram: ' + telegram.toString());

            setImmediate(() => {
                telegram = telegram
                    ? require('./modules/telegram.js')
                    : { send: () => {}, init: () => {} };
                telegram.init();
            });
            setImmediate(() => {
                messenger = messenger
                    ? require('./modules/messenger.js')
                    : { send: () => {} };
            });

            chats = {
                [groupTgId]: groupMsgrId,
                [testTgId]: testMsgrId
            };
        });
    } else {
        jsonfile.writeFile(
            'config.json',
            {
                debug: false,
                previewTextLimit: 8,
                downloadToBuffer: true,
                lang: 'en-US',
                groupTgId: -1234567890,
                groupMsgrId: 12345678998765432,
                messenger: true,
                fbAccount: {
                    email: 'YOUR_FB_ACCOUNT@EMAIL.COM',
                    password: 'YOUR_FB_PASSWORD'
                },
                telegram: true,
                tgUsers: {
                    1234567890: 'Nickname for specified ID'
                },
                tgToken: 'TG_BOT_TOKEN'
            },
            { spaces: 2 },
            () => {
                console.error(lang.configError);
                process.exit();
            }
        );
    }
};

init();
tgGetMsgrInfo = (
    userId,
    userName,
    replyToId,
    replyToName,
    forwardFromId,
    forwardFromName
) => {
    userName = userId in tgUsers ? tgUsers[userId] : userName || userId;
    if (replyToId != telegram.id) {
        replyToName =
            replyToId in tgUsers ? tgUsers[replyId] : replyToName || replyToId;
    }
    forwardFromName =
        forwardFromId in tgUsers
            ? tgUsers[forwardFromId]
            : forwardFromName || forwardFromId;
    var threadId = groupMsgrId;
    return [userName, threadId, replyToName, forwardFromName];
};

exports.telegramMessage = ({
    userId,
    text = '',
    userName,
    addition = '',
    replyToId,
    replyToName,
    forwardFromId,
    forwardFromName,
    replyToText,
    attachment,
    sticker,
    cb = () => {},
    isSliced,
    isEdited,
    title,
    options
}) => {
    [userName, threadId, replyToName, forwardFromName] = tgGetMsgrInfo(
        userId,
        userName,
        replyToId,
        replyToName,
        forwardFromId,
        forwardFromName
    );

    if (!threadId) return;
    if (replyToName) {
        text = isSliced
            ? '*{}:*\n*[{}]*\n> {}...\n{}'.format(
                  userName,
                  lang.inReplyTo.format(replyToName),
                  replyToText,
                  text
              )
            : '*{}:*\n*[{}]*\n> {}\n{}'.format(
                  userName,
                  lang.inReplyTo.format(replyToName),
                  replyToText,
                  text
              );
    } else if (forwardFromName) {
        text = '*{}:*\n*[{}]*\n{}'.format(
            userName,
            lang.forwardedFrom.format(forwardFromName),
            text
        );
    } else if (isEdited) {
        text = '> {}\n*{}:*\n{}'.format(lang.edited, userName, text);
        text += addition;
    } else text = '*{}:*\n{}'.format(userName, text);
    text += addition;

    if (title) {
        text = text.split('*').join('');
        setImmediate(() =>
            messenger.createPoll({
                title: text + title,
                threadId: threadId,
                options: options,
                cb: cb
            })
        );
    } else {
        setImmediate(() =>
            messenger.send(
                removeEmpty({
                    text: text,
                    threadId: threadId,
                    attachment: attachment,
                    sticker: sticker,
                    cb: cb
                })
            )
        );
    }
};

msgrGetTgInfo = (senderId, userName) => {
    userName = userName || senderId;
    var chatId = groupTgId;
    return [userName, chatId];
};

exports.messengerMessage = ({
    photo,
    file,
    video,
    senderId,
    userName,
    addition = '',
    cb = () => {}
} = {}) => {
    [userName, chatId] = msgrGetTgInfo(senderId, userName);
    if (!chatId) return;
    if (photo) {
        setImmediate(() =>
            telegram.send({
                photo: photo,
                chatId: chatId,
                text: '*{}:*\n'.format(userName) + addition,
                cb: cb
            })
        );
    } else if (file) {
        setImmediate(() =>
            telegram.send({
                doc: file,
                chatId: chatId,
                text: '*{}:*\n'.format(userName) + addition,
                cb: cb
            })
        );
    } else if (video) {
        setImmediate(() =>
            telegram.send({
                video: video,
                chatId: chatId,
                text: '*{}:*\n'.format(userName) + addition,
                cb: cb
            })
        );
    } else {
        text = '*{}:*\n{}'.format(userName, addition);
        setImmediate(() =>
            telegram.send({ text: text, chatId: chatId, cb: cb })
        );
    }
};

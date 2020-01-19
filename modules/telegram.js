const fs = require('fs');
const mime = require('mime-types');
const streamBuffers = require('stream-buffers');
const sharp = require('sharp');
const format = require('string-format');
const phoneNumber = require('awesome-phonenumber');
const main = require('../main.js');
const JSON_log = require('../helpers/JSON_log');
const TelegramBot = require('node-telegram-bot-api');
const convertFile = require('../helpers/tgs-to-gif');

const lang = main.lang;
const token = main.tgToken;
const telegram = new TelegramBot(token, { polling: true });
const previewTextLimit = main.previewTextLimit;

const firstUpperCase = ([first, ...rest]) =>
    first.toUpperCase() + rest.join('');
format.extend(String.prototype, {});
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

exports.init = () =>
    telegram.getMe().then(result => {
        exports.id = result.id;
    });

exports.send = ({
    text = '',
    chatId = main.testTgId,
    photo,
    audio,
    doc,
    game,
    video,
    voice,
    videoNote,
    venue,
    contact,
    location,
    sticker,
    cb = () => {}
} = {}) => {
    let parse_mode = 'Markdown';
    if (photo) {
        setImmediate(() =>
            telegram
                .sendPhoto(chatId, photo, {
                    caption: text,
                    parse_mode: parse_mode
                })
                .then(() => cb())
        );
    } else if (audio) {
        setImmediate(() =>
            telegram
                .sendAudio(
                    chatId,
                    audio,
                    { caption: text, parse_mode: parse_mode },
                    { contentType: mime.lookup(audio) }
                )
                .then(() => cb())
        );
    } else if (doc) {
        setImmediate(() =>
            telegram
                .sendDocument(
                    chatId,
                    doc,
                    { caption: text, parse_mode: parse_mode },
                    { contentType: mime.lookup(doc) }
                )
                .then(() => cb())
        );
    } else if (game) {
        setImmediate(() => telegram.sendGame(chatId, game).then(() => cb()));
    } else if (video) {
        setImmediate(() =>
            telegram
                .sendVideo(
                    chatId,
                    video,
                    { caption: text, parse_mode: parse_mode },
                    { contentType: mime.lookup(video) }
                )
                .then(() => cb())
        );
    } else if (voice) {
        setImmediate(() =>
            telegram
                .sendVoice(
                    chatId,
                    voice,
                    { caption: text, parse_mode: parse_mode },
                    { contentType: mime.lookup(voice) }
                )
                .then(() => cb())
        );
    } else if (videoNote) {
        setImmediate(() =>
            telegram
                .sendVideoNote(
                    chatId,
                    videoNote,
                    {},
                    { contentType: mime.lookup(videoNote) }
                )
                .then(() => cb())
        );
    } else if (venue) {
        setImmediate(() =>
            telegram
                .sendVenue(
                    chatId,
                    venue.latitude,
                    venue.longitude,
                    venue.title,
                    venue.address
                )
                .then(() => cb())
        );
    } else if (contact) {
        setImmediate(() =>
            telegram
                .sendContact(chatId, contact.phoneNumber, contact.firstName)
                .then(() => cb())
        );
    } else if (location) {
        setImmediate(() =>
            telegram
                .sendLocation(chatId, location.latitude, location.longitude)
                .then(() => cb())
        );
    } else if (sticker) {
        setImmediate(() =>
            telegram.sendSticker(chatId, sticker).then(() => cb())
        );
    } else {
        setImmediate(() =>
            telegram
                .sendMessage(chatId, text, { parse_mode: parse_mode })
                .then(() => cb())
        );
    }
};

getMessageBasicInfo = message => {
    var text = message.caption || message.text || '';
    var chatId = message.chat.id;
    var userId = message.from.id;
    var userName = message.from.first_name;
    var addition = '';

    if (message.reply_to_message) {
        var replyToId = message.reply_to_message.from.id;
        var replyToName = message.reply_to_message.from.first_name;
        var replyToText =
            message.reply_to_message.caption || message.reply_to_message.text;
        if (!replyToText) {
            replyToText = '{}'.format(
                firstUpperCase(
                    [
                        'text',
                        'audio',
                        'document',
                        'game',
                        'photo',
                        'sticker',
                        'video',
                        'voice',
                        'video_note',
                        'contact',
                        'location',
                        'venue'
                    ]
                        .filter(x => message.reply_to_message[x])
                        .pop()
                        .replace('_note', ' Note')
                )
            );
            var noTextInOriginMessage = true;
        }
        if (replyToId == exports.id) {
            replyToName = message.reply_to_message.text.split(':\n')[0];
            var offset = ':\n'.length;
            var isSliced = noTextInOriginMessage
                ? false
                : replyToText.length >
                  replyToName.length + offset + previewTextLimit;
            replyToText = noTextInOriginMessage
                ? replyToText
                : replyToText.substr(
                      replyToName.length + offset,
                      previewTextLimit
                  );
        } else {
            var isSliced = noTextInOriginMessage
                ? false
                : replyToText.length > previewTextLimit;
            replyToText = noTextInOriginMessage
                ? replyToText
                : replyToText.substr(0, previewTextLimit);
        }
    }
    if (message.forward_from) {
        var forwardFromId = message.forward_from.id;
        if (forwardFromId == exports.id)
            var forwardFromName = message.forward_from.text.split(':\n')[0];
        else
            var forwardFromName =
                message.forward_from.first_name +
                (message.forward_from.last_name
                    ? ' ' + message.forward_from.last_name
                    : '');
    }
    if (message.forward_from_chat) {
        var forwardFromId = message.forward_from_chat.id;
        var forwardFromName = message.forward_from_chat.title
            ? message.forward_from_chat.title
            : '@' + message.forward_from_chat.username;
    }
    return [
        text,
        chatId,
        userId,
        userName,
        addition,
        replyToId,
        replyToName,
        replyToText,
        forwardFromId,
        forwardFromName,
        isSliced
    ];
};

handleInlineButtons = (message, text) => {
    const links = [];
    if (message.reply_markup && message.reply_markup.inline_keyboard) {
        message.reply_markup.inline_keyboard[0].forEach(button => {
            if (button.url) {
                links.push('{}: {}'.format(button.text, button.url));
            }
        });
    }
    if (links.length > 0) {
        const button_links_text = links.join('\n');
        text += '\n\n' + button_links_text;
    }
    return text;
};

telegram.on('text', message => {
    if (message.chat.id != main.groupTgId) return;
    [
        text,
        chatId,
        userId,
        userName,
        addition,
        replyToId,
        replyToName,
        replyToText,
        forwardFromId,
        forwardFromName,
        isSliced
    ] = getMessageBasicInfo(message);
    setImmediate(() =>
        main.telegramMessage({
            userId: userId,
            userName: userName,
            text: handleInlineButtons(message, text),
            replyToId: replyToId,
            replyToName: replyToName,
            forwardFromId: forwardFromId,
            forwardFromName: forwardFromName,
            replyToText: replyToText,
            addition: addition,
            isSliced: isSliced
        })
    );
});

telegram.on('edited_message', message => {
    if (message.chat.id != main.groupTgId) return;
    [
        text,
        chatId,
        userId,
        userName,
        addition,
        replyToId,
        replyToName,
        replyToText,
        forwardFromId,
        forwardFromName,
        isSliced
    ] = getMessageBasicInfo(message);
    setImmediate(() =>
        main.telegramMessage({
            userId: userId,
            userName: userName,
            text: handleInlineButtons(message, text),
            replyToId: replyToId,
            replyToName: replyToName,
            forwardFromId: forwardFromId,
            forwardFromName: forwardFromName,
            replyToText: replyToText,
            addition: addition,
            isSliced: isSliced,
            isEdited: true
        })
    );
});

telegram.on('message', message => {
    if (message.chat.id != main.groupTgId) return;
    [
        text,
        chatId,
        userId,
        userName,
        addition,
        replyToId,
        replyToName,
        replyToText,
        forwardFromId,
        forwardFromName,
        isSliced
    ] = getMessageBasicInfo(message);
    if (message.poll) {
        var poll_options = new Object();

        message['poll'].options.forEach(value => {
            var option_text = value.text;
            var option_count = value.voter_count;
            poll_options[option_text] = option_count;
        });

        setImmediate(() => {
            main.telegramMessage({
                userId: userId,
                userName: userName,
                text: handleInlineButtons(message, text),
                replyToId: replyToId,
                replyToName: replyToName,
                forwardFromId: forwardFromId,
                forwardFromName: forwardFromName,
                replyToText: replyToText,
                addition: addition,
                isSliced: isSliced,
                title: message['poll'].question,
                options: poll_options
            });
        });
    }
});

telegram.on('sticker', message => {
    if (message.chat.id != main.groupTgId) return;
    [
        text,
        chatId,
        userId,
        userName,
        addition,
        replyToId,
        replyToName,
        replyToText,
        forwardFromId,
        forwardFromName,
        isSliced
    ] = getMessageBasicInfo(message);

    var file = message['sticker'];
    var fileId = file.file_id;

    if (message['sticker'].is_animated) {
        const original_attachment = telegram.getFileStream(fileId);
        const filename = 'animated.gif';
        convertFile(original_attachment, filename).then(value => {
            const readStream = fs.createReadStream(filename);
            main.telegramMessage({
                userId: userId,
                userName: userName,
                text: handleInlineButtons(message, text),
                replyToId: replyToId,
                replyToName: replyToName,
                forwardFromId: forwardFromId,
                forwardFromName: forwardFromName,
                replyToText: replyToText,
                attachment: readStream,
                isSliced: isSliced
            });
        });
    } else {
        setImmediate(() => {
            var original_attachment = telegram.getFileStream(fileId);
            original_attachment.path += '.webp';
            const filename = 'sticker.png';
            const transformer = sharp()
                .resize(message['sticker'].width, message['sticker'].height)
                .png()
                .toFile(filename, function(err, info) {
                    if (err) {
                        throw err;
                    }
                    const readStream = fs.createReadStream(filename);
                    main.telegramMessage({
                        userId: userId,
                        userName: userName,
                        text: handleInlineButtons(message, text),
                        replyToId: replyToId,
                        replyToName: replyToName,
                        forwardFromId: forwardFromId,
                        forwardFromName: forwardFromName,
                        replyToText: replyToText,
                        attachment: readStream,
                        isSliced: isSliced
                    });
                });
            original_attachment.pipe(transformer);
        });
    }
});

['audio', 'document', 'photo', 'video', 'voice', 'video_note'].forEach(x =>
    telegram.on(x, message => {
        if (message.chat.id != main.groupTgId) return;
        [
            text,
            chatId,
            userId,
            userName,
            addition,
            replyToId,
            replyToName,
            replyToText,
            forwardFromId,
            forwardFromName,
            isSliced
        ] = getMessageBasicInfo(message);
        var file = x == 'photo' ? message[x].pop() : message[x];
        var fileId = file.file_id;
        var extension = '';

        if (message['animation']) {
            extension = 'gif';
            setImmediate(() => {
                var original_attachment = telegram.getFileStream(fileId);
                original_attachment.path += '.' + extension;
                main.telegramMessage({
                    userId: userId,
                    userName: userName,
                    text: handleInlineButtons(message, text),
                    replyToId: replyToId,
                    replyToName: replyToName,
                    forwardFromId: forwardFromId,
                    forwardFromName: forwardFromName,
                    replyToText: replyToText,
                    attachment: original_attachment,
                    isSliced: isSliced
                });
            });
            return;
        }

        switch (x) {
            case 'video_note':
                extension = 'mp4';
                break;
            case 'photo':
                extension = 'png';
                break;
            default:
                extension = file.mime_type
                    ? file.mime_type == 'audio/mpeg3'
                        ? 'mp3'
                        : mime.extension(file.mime_type)
                    : file.file_path.split('.').pop();
                break;
        }

        setImmediate(() => {
            var original_attachment = telegram.getFileStream(fileId);
            original_attachment.path = message['document']
                ? message['document'].file_name
                : original_attachment.path + '.' + extension;
            main.telegramMessage({
                userId: userId,
                userName: userName,
                text: handleInlineButtons(message, text),
                replyToId: replyToId,
                replyToName: replyToName,
                forwardFromId: forwardFromId,
                forwardFromName: forwardFromName,
                replyToText: replyToText,
                attachment: original_attachment,
                isSliced: isSliced
            });
        });
    })
);

telegram.on('location', message => {
    if (message.chat.id != main.groupTgId) return;
    [
        text,
        chatId,
        userId,
        userName,
        addition,
        replyToId,
        replyToName,
        replyToText,
        forwardFromId,
        forwardFromName,
        isSliced
    ] = getMessageBasicInfo(message);
    var location = message.location;
    addition += 'https://www.google.com/maps/@{},{},16z'.format(
        location.latitude,
        location.longitude
    );
    setImmediate(() =>
        main.telegramMessage({
            userId: userId,
            userName: userName,
            text: handleInlineButtons(message, text),
            replyToId: replyToId,
            replyToName: replyToName,
            forwardFromId: forwardFromId,
            forwardFromName: forwardFromName,
            replyToText: replyToText,
            addition: addition,
            isSliced: isSliced
        })
    );
});

telegram.on('contact', message => {
    if (message.chat.id != main.groupTgId) return;
    [
        text,
        chatId,
        userId,
        userName,
        addition,
        replyToId,
        replyToName,
        replyToText,
        forwardFromId,
        forwardFromName,
        isSliced
    ] = getMessageBasicInfo(message);
    var contact = message.contact;

    if (contact.first_name) {
        addition += contact.last_name
            ? contact.first_name + contact.last_name
            : contact.first_name;
    }
    if (contact.phone_number) {
        const pn = new phoneNumber('+' + contact.phone_number);
        addition += ': ' + pn.getNumber('international');
    }

    setImmediate(() =>
        main.telegramMessage({
            userId: userId,
            userName: userName,
            text: handleInlineButtons(message, text),
            replyToId: replyToId,
            replyToName: replyToName,
            forwardFromId: forwardFromId,
            forwardFromName: forwardFromName,
            replyToText: replyToText,
            addition: addition,
            isSliced: isSliced
        })
    );
});

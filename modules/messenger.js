const fs = require('fs');
const main = require('../main.js');
const http = require('http');
const https = require('https');
const fb = require('facebook-chat-api');
const buffer = require('request').defaults({ encoding: null });
const format = require('string-format');
const {
    JSON_log,
    removeEmpty
} = require('../helpers/utils');

const fbAccount = main.fbAccount;
const lang = main.lang;

format.extend(String.prototype, {});

const download = main.downloadToBuffer
    ? (url, dest, cb) =>
          buffer.get(url, (err, res, body) => {
              if (err) {
                  console.error(err);
                  return;
              }
              cb(body);
          })
    : (url, dest, cb) => {
          let file = fs.createWriteStream(dest);
          let protocal = url.split(':')[0].slice(-1) == 's' ? https : http;
          let request = protocal
              .get(url, response => {
                  response.pipe(file);
                  file.on('finish', () => {
                      file.close(() => cb(dest));
                  });
              })
              .on('error', err => {
                  fs.unlink(dest);
                  console.error(err);
              });
      };

handleAttachments = (event, body) => {
    let results = {
        photo: null,
        video: null,
        voice: null,
        addition: '',
        file: null,
        fileName: null,
        cb: () => {}
    };

    for (let i of event.attachments) {
        switch (i.type) {
            case 'sticker':
            case 'animated_image':
            case 'photo':
                let properUrl =
                    i.url
                        .split('.')
                        .pop()
                        .split('?')[0] || i.stickerID + '.png';
                let fileName = i.ID + '.' + properUrl;
                results.fileName = fileName;
                results.photo = cb => download(i.url, fileName, x => cb(x));
                break;
            case 'file':
                let fileName = i.name;
                results.fileName = fileName;
                results.file = cb => download(i.url, fileName, x => cb(x));
                break;
            case 'video':
                let fileName = i.filename;
                results.fileName = fileName;
                results.video = cb => download(i.url, fileName, x => cb(x));
                break;
            case 'audio':
                let extension = i.url
                    .split('.')
                    .pop()
                    .split('?')[0];
                let audioType = 'file';
                let fileName = i.filename;
                if (extension == 'mp4') {
                    fileName += '.mp3';
                } else if ((extension == 'off') | (extension == 'opus'))
                    let audioType = 'voice';
                results.fileName = fileName;
                results[audioType] = cb =>
                    download(i.url, fileName, x => cb(x));
                break;
            case 'share':
                if (!i.url.includes('//l.facebook.com/l.php?u=')) {
                    let properTitle =
                        i.title == '' ? i.source + ' Post' : i.title;
                    let descriptionLimit =
                        i.description.length <= main.previewTextLimit
                            ? ''
                            : '...';
                    let url_text = i.description
                        ? i.source +
                          ': ' +
                          i.description.substr(0, main.previewTextLimit) +
                          descriptionLimit
                        : properTitle;

                    // if url is a Facebook resource
                    let linkHTML = '[{}]({})'.format(url_text, i.url);
                    let text = body + '\n' + linkHTML;
                    results.addition = text;
                    break;
                } else {
                    let url = decodeURIComponent(
                        i.url.split('//l.facebook.com/l.php?u=')[1]
                    );
                    let text = '[{}]({})'.format(body, i.title, url);
                    results.addition = text;
                    break;
                }
        }
    }
    return results;
};

const supported_types = ['message', 'message_reply'];

if (fs.existsSync('appstate.json')) {
    fb(
        { appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8')) },
        (err, api) => {
            if (err) return console.error(err);

            fs.writeFileSync(
                'appstate.json',
                JSON.stringify(api.getAppState())
            );

            exports.send = ({
                text = '',
                threadId = main.testMsgrId,
                attachment,
                sticker,
                cb = () => {}
            }) =>
                api.sendMessage(
                    removeEmpty({
                        body: text,
                        attachment: attachment,
                        sticker: sticker
                    }),
                    threadId,
                    cb
                );

            exports.createPoll = ({
                title = '',
                threadId = main.testMsgrId,
                options,
                cb = () => {}
            }) => api.createPoll(title, threadId, options, cb);

            id = api.getCurrentUserID();
            exports.id = id;

            api.listenMqtt((err, event) => {
                if (err) return console.error(err);
                if (event.threadID != main.groupMsgrId) return;
                if (!supported_types.includes(event.type)) return;

                let threadID = event.threadID;
                let senderID = event.senderID;

                if (senderID == id) return;

                let body = event.body;

                api.getThreadInfo(threadID, (err, info) => {
                    if (err) return console.log(err);

                    const userNameResolved = (event, userName, senderID) => {
                        let mainMessage = {
                            userName: userName,
                            addition: body,
                            senderID: senderID
                        };

                        if (event.attachments.length != 0) {
                            mainMessage = Object.assign(
                                {},
                                mainMessage,
                                handleAttachments(event, body)
                            );
                        }

                        switch (event.type) {
                            case 'message':
                                setImmediate(() =>
                                    main.messengerMessage(mainMessage)
                                );
                                break;
                            case 'message_reply':
                                const replyNameResolved = (
                                    replyEvent,
                                    replyToName
                                ) => {
                                    setImmediate(() =>
                                        main.messengerMessage(
                                            Object.assign({}, mainMessage, {
                                                replyToName: replyToName,
                                                replyToText: replyEvent.body
                                            })
                                        )
                                    );
                                };

                                let replyEvent = event.messageReply;
                                let replyToName =
                                    replyEvent.senderID in nicknames
                                        ? nicknames[replyEvent.senderID]
                                        : api.getUserInfo(
                                              replyEvent.senderID,
                                              (err, users) => {
                                                  if (err)
                                                      return console.error(err);

                                                  replyNameResolved(
                                                      replyEvent,
                                                      users[replyEvent.senderID]
                                                          .name
                                                  );
                                              }
                                          );

                                if (replyToName)
                                    replyNameResolved(replyEvent, replyToName);
                                break;
                            case 'event':
                                console.log(event);
                                break;
                        }
                    };

                    let nicknames = info.nicknames;
                    let userName =
                        senderID in nicknames
                            ? nicknames[senderID]
                            : api.getUserInfo(senderID, (err, users) => {
                                  if (err) return console.error(err);
                                  userNameResolved(
                                      event,
                                      users[senderID].name,
                                      senderID
                                  );
                              });

                    if (userName) userNameResolved(event, userName, senderID);
                });
            });
        }
    );
} else {
    fb(fbAccount, (err, api) => {
        if (err) return console.error(err);
        fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
        console.log(lang.sessionSaved);
        process.exit();
    });
}

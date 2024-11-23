const { DisconnectReason, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const { default: pino } = require('pino')
const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))


async function connectToWhatsapp() {
    const usingPairingCode = process.argv.includes('--pairing-code')
    const { state, saveCreds } = await useMultiFileAuthState('auth')

    const listHama = [
        '6288971657260@s.whatsapp.net',
    ]

    const sock = makeWASocket({
        printQRInTerminal: !usingPairingCode,
        auth: state,
        logger: pino({ level: 'silent' })
    })

    if (usingPairingCode && !sock.authState.creds.registered) {
        setTimeout(async () => {
            let phone = await question('Enter phone number: ')
            const code = await sock.requestPairingCode(phone)

            console.log(code)
        }, 5000)
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed', lastDisconnect.error, 'reconnection', shouldReconnect)

            if (shouldReconnect) {
                connectToWhatsapp()
            }
        } else if (connection === 'open') {
            console.log('Successfully connected to: ' + JSON.stringify(sock.user, null, 2))
        }
    })

    // listen for new messages
    sock.ev.on('messages.upsert', async (m) => {
        if (m.messages[0].key.fromMe) {
            return
        }

        console.log('message from : ' + JSON.stringify(m.messages[0].pushName))
        console.log('message : ' + JSON.stringify(m.messages[0].message.conversation))

        if (!listHama.some(hama => hama === m.messages[0].key.remoteJid)) return
        console.log('replying to', m.messages[0].key.remoteJid)
        await sock.sendMessage(m.messages[0].key.remoteJid, { text: "Stop barking dude😂" })
    })
}


connectToWhatsapp()
/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    connectionException
} = require('@routr/utils/exception_helpers')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const ExpiresHeader = Java.type('javax.sip.header.ExpiresHeader')
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const AccountManager = Java.type('gov.nist.javax.sip.clientauthutils.AccountManager')
const UserCredentials = Java.type('gov.nist.javax.sip.clientauthutils.UserCredentials')
const SipFactory = Java.type('javax.sip.SipFactory')
const headerFactory = SipFactory.getInstance().createHeaderFactory()

const hasCodes = (r, c) => c.filter(code => r.getStatusCode() === code).length > 0
const isMethod = (r, m) => m.filter(method => r.getHeader(CSeqHeader.NAME).getMethod() === method).length > 0
const isOk = r => hasCodes(r, [Response.OK])
const mustAuthenticate = r => hasCodes(r, [Response.PROXY_AUTHENTICATION_REQUIRED, Response.UNAUTHORIZED])
const isStackJob = r => hasCodes(r, [Response.TRYING, Response.REQUEST_TERMINATED]) ||
    isMethod(r, [Request.CANCEL])
const isTransactional = event => event.getClientTransaction() !== null &&
    isMethod(event.getResponse(), [Request.INVITE, Request.MESSAGE])
const isRegister = r => isMethod(r, [Request.REGISTER])
const isRegisterOk = r => isOk(r) && isRegister(r)
const isRegisterNok = r => !isOk(r) && isRegister(r)
const isBehindNat = r => {
    const v = r.getHeader(ViaHeader.NAME)
    return !v.getHost().equals(v.getReceived()) || v.getPort() !== v.getRPort()
}
const getAccountManager = gateway => {
    const buildAddr = (h, p) => `${h}${p? ':' + p: ''}`
    return new AccountManager({
        getCredentials: () => {
            return new UserCredentials({
                getUserName: () => gateway.spec.credentials.username,
                getPassword: () => gateway.spec.credentials.secret,
                getSipDomain: () => buildAddr(gateway.spec.host, gateway.spec.port)
            })
        }
    })
}
const handleAuthChallenge = (sipStack, e, gateway) => {
    try {
        const accountManager = getAccountManager(gateway)
        const authHelper = sipStack.getAuthenticationHelper(accountManager, headerFactory)
        // Setting looseRouting to false will cause https://github.com/fonoster/routr/issues/18
        authHelper.handleChallenge(e.getResponse(), e.getClientTransaction(), e.getSource(), 5, true).sendRequest()
    } catch (ex) {
        connectionException(ex,
            e.getClientTransaction().getRequest().getRequestURI().getHost())
    }
}

const getExpires = message => {
    const contactHeader = message.getHeader(ContactHeader.NAME)
    if (contactHeader.getParameter('expires')) {
        return contactHeader.getExpires()
    }
    const expiresHeader = message.getHeader(ExpiresHeader.NAME)
    // Considere instead triggering an exception
    return expiresHeader ? expiresHeader.getExpires() : 0
}

module.exports.hasCodes = hasCodes
module.exports.isMethod = isMethod
module.exports.isOk = isOk
module.exports.mustAuthenticate = mustAuthenticate
module.exports.isStackJob = isStackJob
module.exports.isTransactional = isTransactional
module.exports.isRegister = isRegister
module.exports.isRegisterOk = isRegisterOk
module.exports.isRegisterNok = isRegisterNok
module.exports.isBehindNat = isBehindNat
module.exports.isBehindNat = isBehindNat
module.exports.handleAuthChallenge = handleAuthChallenge
module.exports.getExpires = getExpires

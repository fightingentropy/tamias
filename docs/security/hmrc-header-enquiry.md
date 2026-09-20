# Prepared email — not sent

To: SDSTeam@hmrc.gov.uk
Subject: Tamias — fraud prevention headers for a Cloudflare-hosted web application

Hello Software Developer Support,

We are preparing Tamias, a subscription web application, for production access. It connects to the Making Tax Digital APIs from Cloudflare Workers using WEB_APP_VIA_SERVER.

We have corrected the header formatting and checked it with your sandbox validator. Our complete synthetic fixture returns VALID_HEADERS; that is a formatting test, not a claim that our live collection is complete.

We collect the browser's persistent device UUID, JavaScript user agent, screen/window dimensions and timezone, and add the signed-in user's identifiers and the Cloudflare-provided client public IP with its collection timestamp. The remaining network values need confirmation: the browser's public source port, the actual Cloudflare ingress public IP and the corresponding forwarded hop. Cloudflare documents a client-port transform field, which we are investigating. Its edge server-IP field is documented as meaningful only for BYOIP customers; our current zone is not BYOIP.

Tamias currently authenticates users with a password, so there is no additional MFA factor to report. It is a SaaS subscription, with no per-device software licence key.

Could you confirm the appropriate treatment of the MFA and licence-ID headers in this setup, and advise on the exceptional missing-data process if Cloudflare cannot expose the actual ingress network values? We will not supply placeholders or declare full readiness while this is unresolved.

Kind regards,
Erlin Hoxha
Tamias
support@tamias.xyz

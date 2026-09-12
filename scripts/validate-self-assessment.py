"""Validate a synthetic GovTalk fixture using the official HMRC package and libxml2.

Usage: python scripts/validate-self-assessment.py /path/to/HMRC-package fixture.xml
Obtain HMRC-RIM-MTR-2026-v1.2.zip from the GOV.UK 2026 technical specifications.
No live submission is made. Keep real personal records out of validation fixtures.
"""
import base64
import hashlib
import pathlib
import sys
from lxml import etree

package, fixture = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
parser = etree.XMLParser(resolve_entities=False, no_network=True)
class LocalSignatureSchema(etree.Resolver):
    def resolve(self, url, public_id, context):
        if url == "http://www.w3.org/TR/2001/PR-xmldsig-core-20010820/xmldsig-core-schema.xsd":
            return self.resolve_filename(str(package / "xmldsig-core-schema.xsd"), context)
parser.resolvers.add(LocalSignatureSchema())
document = etree.parse(str(fixture), parser)
gov = "http://www.govtalk.gov.uk/CM/envelope"
sa = "http://www.govtalk.gov.uk/taxation/SA/SA100/25-26/1"
body = document.find(f"{{{gov}}}Body")
ir = body.find(f"{{{sa}}}IRenvelope")
schema = etree.XMLSchema(etree.parse(str(package / "MTR-v1-2.xsd"), parser))
schema.assertValid(ir)
etree.XMLSchema(etree.parse(str(package / "envelope-v2-0-HMRC.xsd"), parser)).assertValid(document)
rules = etree.XSLT(etree.parse(str(package / "MTR-v1-2.xslt"), parser))
checked = rules(document)
errors = checked.xpath("//*[local-name()='Error']")
if errors:
    raise SystemExit(etree.tostring(checked, pretty_print=True).decode())
mark = ir.find(f"{{{sa}}}IRheader/{{{sa}}}IRmark")
expected = mark.text
mark.getparent().remove(mark)
canonical = etree.tostring(body, method="c14n", exclusive=False, with_comments=False)
assert base64.b64encode(hashlib.sha1(canonical).digest()).decode() == expected, "IRmark mismatch"
print("HMRC XSD, business rules and independent canonical IRmark validation passed.")

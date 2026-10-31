"""Optional fixture maintenance: Python + pypdf 6.10.0; not part of app runtime.
Run: node -e "require('fs').writeFileSync('artifacts/plain-fixture.pdf',require('./tests/fixtures.cjs').makePDF())"
then: python3 tests/encrypt-fixture.py
The committed encrypted.pdf is original synthetic content, password: reader-test.
"""
from pypdf import PdfReader, PdfWriter
writer = PdfWriter(clone_from=PdfReader('artifacts/plain-fixture.pdf'))
writer.encrypt('reader-test')
writer.write('tests/encrypted.pdf')

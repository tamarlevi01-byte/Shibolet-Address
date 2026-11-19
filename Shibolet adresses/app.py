import csv
from dataclasses import astuple
from hashlib import sha256
from io import BytesIO, StringIO
from pathlib import Path
from zipfile import BadZipFile

import pandas as pd
import streamlit as st

from addresses import split_address

FIELDS = ("רחוב", "מספר בית", "דירה", "יישוב", "סטטוס פיצול")

st.set_page_config(page_title="שיבולת | הסדרת כתובות", page_icon="📍", layout="wide")
st.markdown(
    "<style>.stMain,.stSidebar{direction:rtl}</style>",
    unsafe_allow_html=True,
)
st.title("שיבולת | הסדרת כתובות")
st.write("העלו קובץ גבייה, בחרו את עמודת הכתובת ותקנו את התוצאות לפני הייצוא.")

upload = st.file_uploader("קובץ גבייה", type=["xlsx", "csv"])
if upload is None:
    st.stop()

raw = upload.getvalue()
file_id = sha256(raw).hexdigest()
sheet = None
try:
    if Path(upload.name).suffix.lower() == ".xlsx":
        with pd.ExcelFile(BytesIO(raw), engine="openpyxl") as workbook:
            sheet = st.selectbox("גיליון", workbook.sheet_names, key=f"sheet-{file_id}")
            source = workbook.parse(sheet, dtype=str, keep_default_na=False)
    else:
        for encoding in ("utf-8-sig", "cp1255"):
            try:
                decoded = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                if encoding == "cp1255":
                    raise
        try:
            delimiter = csv.Sniffer().sniff(decoded[:8192], delimiters=",;\t").delimiter
        except csv.Error:
            delimiter = ","
        source = pd.read_csv(
            StringIO(decoded), sep=delimiter, dtype=str, keep_default_na=False,
        )
except (OSError, ValueError, KeyError, SyntaxError, BadZipFile):
    st.error("לא ניתן לקרוא את הקובץ. בדקו שהוא תקין ושהפורמט תואם לסיומת.")
    st.stop()

if source.empty:
    st.info("אין שורות נתונים בקובץ שנבחר.")
    st.stop()

columns = list(source.columns)
default = next((i for i, name in enumerate(columns) if "כתובת" in str(name)), 0)
column = st.selectbox("עמודת כתובת", columns, index=default, key=f"column-{file_id}-{sheet}")
used = set(columns)
output_fields = []
for field in FIELDS:
    candidate = field
    suffix = 2
    while candidate in used:
        candidate = f"{field} ({suffix})"
        suffix += 1
    used.add(candidate)
    output_fields.append(candidate)

results = pd.DataFrame(
    [astuple(split_address(value)) for value in source[column].fillna("")],
    columns=output_fields,
    index=source.index,
)
preview = pd.concat([source[[column]], results], axis=1)
st.caption("אפשר לערוך את עמודות התוצאה בטבלה. הכתובת המקורית נשמרת.")
edited = st.data_editor(
    preview, hide_index=True, disabled=[column], width="stretch",
    key=f"editor-{file_id}-{sheet}-{column}",
    column_config={
        output_fields[-1]: st.column_config.SelectboxColumn(
            options=["פוצלה", "לבדיקה", "חסרה כתובת", "תוקנה"],
            required=True,
        ),
    },
)
pending = edited[output_fields[-1]].ne("פוצלה") & edited[output_fields[-1]].ne("תוקנה")
st.write(f"{len(source):,} רשומות · {int(pending.sum()):,} לבדיקה או עם כתובת חסרה")

final = pd.concat([source, edited[output_fields]], axis=1)
output = BytesIO()
with pd.ExcelWriter(output, engine="openpyxl") as writer:
    final.to_excel(writer, index=False, sheet_name="כתובות")
    for row in writer.sheets["כתובות"].iter_rows():
        for cell in row:
            if cell.data_type == "f":
                cell.data_type = "s"

st.download_button(
    "הורדת קובץ Excel",
    output.getvalue(),
    file_name=f"{Path(upload.name).stem}-כתובות.xlsx",
    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
)

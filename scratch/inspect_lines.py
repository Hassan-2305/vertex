with open(r'c:\Users\moham\OneDrive\Desktop\TradeForge\branch1\vertex\src\pages\ResetPasswordPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i in range(13, 27):
    print(f"{i+1}: {repr(lines[i])}")

import smtplib

try:
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login("dummy.150905@gmail.com", "Khush_dummy_1509")
    print("Login successful on 587")
    server.quit()
except Exception as e:
    print("Error:", e)

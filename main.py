def on_forever():
    nanins.write_v_max(nanins.NOSE_TAIL.NOSE, 0)
    radio.send_value("abta", 0)
basic.forever(on_forever)

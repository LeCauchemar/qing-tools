from PIL import Image
src = Image.open(r"shots/389-compact-flat.png")
crop = src.crop((720, 0, 860, 120)).resize((560, 480), Image.NEAREST)
crop.save(r"shots/390-sat-zoom2.png")
print("ok")

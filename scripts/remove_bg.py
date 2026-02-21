import os
import glob
from rembg import remove
from PIL import Image

def process_images():
    input_dir = "buttons_assets/generated"
    output_dir = "buttons_assets/generated/transparent"
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for image_path in glob.glob(os.path.join(input_dir, "*.png")):
        filename = os.path.basename(image_path)
        output_path = os.path.join(output_dir, filename)
        
        print(f"Processing: {filename}")
        
        try:
            input_image = Image.open(image_path)
            output_image = remove(input_image)
            output_image.save(output_path, "PNG")
            print(f"Saved: {output_path}")
        except Exception as e:
            print(f"Failed to process {filename}: {e}")

if __name__ == "__main__":
    process_images()

import os
import time
import uuid
from flask import Flask, request, jsonify, send_from_directory, render_template
from werkzeug.utils import secure_filename
from PIL import Image

# Initialize the Flask application
app = Flask(__name__)

# --- Configuration Settings ---
# Directory paths for temporary file uploads and generated PDFs
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
PDF_FOLDER = os.path.join(BASE_DIR, 'generated_pdfs')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PDF_FOLDER'] = PDF_FOLDER

# Standard Flask limit for requests (16 Megabytes)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 

# Supported file formats
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'webp'}

# Ensure necessary directories exist on startup
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PDF_FOLDER, exist_ok=True)


# --- Helper Functions ---

def allowed_file(filename):
    """Check if the uploaded file has one of the supported extensions."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def clean_temp_files(max_age_seconds=900):
    """
    Scans the uploads and generated_pdfs directories to remove temporary files 
    that are older than the specified age (default is 15 minutes / 900 seconds).
    This keeps the disk usage low and prevents storage leaks.
    """
    now = time.time()
    for folder in [UPLOAD_FOLDER, PDF_FOLDER]:
        if not os.path.exists(folder):
            continue
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            # Avoid deleting special gitkeep files or directories
            if os.path.isdir(file_path) or filename.startswith('.'):
                continue
            
            try:
                # Check creation/modification time of the file
                file_time = os.path.getmtime(file_path)
                if (now - file_time) > max_age_seconds:
                    os.remove(file_path)
                    print(f"Cleaned up temporary file: {file_path}")
            except Exception as e:
                # Log error but don't crash
                print(f"Error cleaning up file {file_path}: {e}")


# --- Routing & Controllers ---

@app.route('/')
def home():
    """Renders the main frontend application dashboard."""
    # Clean files on load to maintain general server hygiene
    clean_temp_files()
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """
    Endpoint: POST /api/upload
    Receives an individual image file, validates type/size, sanitizes name,
    saves it to the uploads folder, and returns a unique temporary reference.
    """
    # Trigger cleanup to purge expired session files
    clean_temp_files()
    
    # Check if file part exists in the incoming request
    if 'image' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
        
    file = request.files['image']
    
    # Check if user submitted an empty selection
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    if file and allowed_file(file.filename):
        # Clean filename to prevent path traversal vulnerability
        original_name = secure_filename(file.filename)
        ext = original_name.rsplit('.', 1)[1].lower()
        
        # Generate a unique filename using UUID to avoid file collisions
        temp_filename = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
        
        try:
            file.save(save_path)
            
            # Read image metadata (dimensions) to report back to frontend
            with Image.open(save_path) as img:
                width, height = img.size
                
            return jsonify({
                'success': True,
                'temp_filename': temp_filename,
                'original_name': original_name,
                'size': os.path.getsize(save_path),
                'dimensions': f"{width}x{height}"
            })
        except Exception as e:
            return jsonify({'error': f"Failed to save file: {str(e)}"}), 500
            
    return jsonify({'error': 'File type not allowed. Supported formats: JPG, JPEG, PNG, BMP, WEBP'}), 400

@app.route('/api/convert', methods=['POST'])
def convert_to_pdf():
    """
    Endpoint: POST /api/convert
    Receives ordered array of temporary filenames and formatting settings.
    Builds a custom sized PDF, saves it, and outputs the download link.
    """
    clean_temp_files()
    
    data = request.json or {}
    temp_filenames = data.get('filenames', [])
    pdf_name = data.get('pdf_name', 'converted_images')
    page_size = data.get('page_size', 'original') # 'original', 'a4', 'letter'
    orientation = data.get('orientation', 'auto') # 'auto', 'portrait', 'landscape'
    margin_option = data.get('margin', 'none')   # 'none', 'small', 'normal'
    
    if not temp_filenames:
        return jsonify({'error': 'No files provided for PDF conversion'}), 400

    # Sanitize output PDF filename
    pdf_name = secure_filename(pdf_name)
    if not pdf_name.endswith('.pdf'):
        pdf_name += '.pdf'

    # Margins in standard PDF points (72 points = 1 inch)
    margins_map = {
        'none': 0,
        'small': 10,
        'normal': 25
    }
    margin = margins_map.get(margin_option, 0)

    # Document sizes in points
    PAGE_DIMENSIONS = {
        'a4': (595.27, 841.89),      # 210mm x 297mm
        'letter': (612.00, 792.00)   # 8.5in x 11in
    }

    processed_pages = []
    
    try:
        for temp_name in temp_filenames:
            img_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_name)
            
            # Security verification: Ensure the file exists and is in the uploads directory
            if not os.path.exists(img_path):
                return jsonify({'error': f"Image file {temp_name} is missing or expired. Please upload it again."}), 400
            
            with Image.open(img_path) as img:
                # Convert color mode to RGB because standard PDF compiling doesn't support RGBA transparency
                if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                    # Handle transparency by creating a white canvas and pasting the image onto it
                    rgba_img = img.convert('RGBA')
                    background = Image.new('RGB', rgba_img.size, (255, 255, 255))
                    background.paste(rgba_img, mask=rgba_img.split()[3]) # paste using alpha channel mask
                    rgb_img = background
                else:
                    rgb_img = img.convert('RGB')
                
                img_w, img_h = rgb_img.size

                # Case 1: Page Size - Original (Keep original pixel dimensions)
                if page_size == 'original':
                    if margin > 0:
                        canvas_w = img_w + (margin * 2)
                        canvas_h = img_h + (margin * 2)
                        page_canvas = Image.new('RGB', (canvas_w, canvas_h), (255, 255, 255))
                        page_canvas.paste(rgb_img, (margin, margin))
                        processed_pages.append(page_canvas)
                    else:
                        # Direct reference needs load() to work outside `with` scope
                        rgb_img.load()
                        processed_pages.append(rgb_img)
                        
                # Case 2: Page Size - Fixed (A4, Letter)
                else:
                    base_w, base_h = PAGE_DIMENSIONS.get(page_size, PAGE_DIMENSIONS['a4'])
                    
                    # Auto orientation swaps based on image width/height aspect ratio
                    if orientation == 'auto':
                        if img_w > img_h:
                            page_w, page_h = base_h, base_w  # Landscape
                        else:
                            page_w, page_h = base_w, base_h  # Portrait
                    elif orientation == 'landscape':
                        page_w, page_h = max(base_w, base_h), min(base_w, base_h)
                    else:  # portrait
                        page_w, page_h = min(base_w, base_h), max(base_w, base_h)
                    
                    # Make Canvas
                    # Since points are small, we scale the canvas up to look high-definition (e.g. 150 DPI)
                    # Point dimensions * scale = Pixels
                    render_dpi = 150
                    dpi_factor = render_dpi / 72.0
                    
                    canvas_px_w = int(page_w * dpi_factor)
                    canvas_px_h = int(page_h * dpi_factor)
                    margin_px = int(margin * dpi_factor)
                    
                    # Printable dimensions
                    print_w = canvas_px_w - (margin_px * 2)
                    print_h = canvas_px_h - (margin_px * 2)
                    
                    # Calculate scaling ratio to fit image inside printable canvas boundaries
                    scale_w = print_w / img_w
                    scale_h = print_h / img_h
                    fit_scale = min(scale_w, scale_h)
                    
                    new_w = int(img_w * fit_scale)
                    new_h = int(img_h * fit_scale)
                    
                    # Use high quality resampling for crispy resizing
                    resized_img = rgb_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    
                    # Create white page canvas in pixels
                    page_canvas = Image.new('RGB', (canvas_px_w, canvas_px_h), (255, 255, 255))
                    
                    # Center the resized image on the canvas
                    paste_x = margin_px + (print_w - new_w) // 2
                    paste_y = margin_px + (print_h - new_h) // 2
                    page_canvas.paste(resized_img, (paste_x, paste_y))
                    
                    processed_pages.append(page_canvas)
        
        if not processed_pages:
            return jsonify({'error': 'No pages processed'}), 500

        # Compile and save PDF
        pdf_filename = f"{uuid.uuid4().hex}_{pdf_name}"
        pdf_path = os.path.join(app.config['PDF_FOLDER'], pdf_filename)
        
        # Save pages to a single PDF using Pillow saving engine
        first_page = processed_pages[0]
        other_pages = processed_pages[1:]
        
        first_page.save(
            pdf_path,
            save_all=True,
            append_images=other_pages,
            resolution=150.0, # Target 150 DPI density
            quality=95
        )
        
        pdf_size = os.path.getsize(pdf_path)

        return jsonify({
            'success': True,
            'pdf_filename': pdf_name,
            'pdf_size': pdf_size,
            'download_url': f"/download/{pdf_filename}"
        })

    except Exception as e:
        return jsonify({'error': f"PDF Conversion failed: {str(e)}"}), 500

@app.route('/download/<filename>')
def download_file(filename):
    """
    Endpoint: GET /download/<filename>
    Retrieves and downloads a converted PDF file from the secure storage folder.
    """
    # Restrict to generated_pdfs folder to prevent directory traversal
    filename = secure_filename(filename)
    pdf_path = os.path.join(app.config['PDF_FOLDER'], filename)
    
    if not os.path.exists(pdf_path):
        return "The requested PDF file is not found, expired, or deleted by system cleanup.", 404
        
    # Get original filename from database/session or clean it up
    # We prefix a UUID to make it unique; we strip it when serving the file so it looks clean to the user
    original_display_name = filename
    if '_' in filename:
        parts = filename.split('_', 1)
        if len(parts[0]) == 32:  # Length of UUID hex
            original_display_name = parts[1]
            
    return send_from_directory(
        app.config['PDF_FOLDER'], 
        filename, 
        as_attachment=True,
        download_name=original_display_name
    )

# Run standard server listener
if __name__ == '__main__':
    # Running in debug mode allows hot reloading during development
    app.run(debug=True, port=5000)

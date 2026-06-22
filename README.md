# ConvertIMG - Modern Image to PDF Converter

ConvertIMG is a feature-rich, high-performance web application that allows users to upload multiple images of various formats (PNG, JPG, JPEG, BMP, WEBP) and compile them into a single, structured PDF file. The application features a modern, responsive user interface with drag-and-drop file staging, layout reordering, dark mode support, and page customization.

---

## Technical Stack

* **Backend**: Python, Flask, Pillow (PIL)
* **Frontend**: HTML5, CSS3, JavaScript (ES6+), Bootstrap 5, Bootstrap Icons
* **Security features**: File upload validation, content size restrictions, and auto-cleanup.

---

## Features

1. **Upload Staging & Image Queue**:
   * Drag & Drop zone with hover micro-animations.
   * Multiple file upload support with interactive upload progress tracking (XHR).
   * Restricts files to 15MB each and checks file extensions on the client and server.

2. **Image Order Rearrangement**:
   * HTML5 Native drag-and-drop thumbnail sorting.
   * Desktop accessibility and mobile fallback via quick move buttons (Chevron-Left / Chevron-Right).
   * Counter badge and delete controls for each thumbnail.

3. **PDF Page Customization**:
   * **Custom Filename**: Pick a target filename before conversion (falls back to custom formats).
   * **Page Size Options**: 
     * **Original Image Size**: Retains dimensions of the uploaded image.
     * **A4 Standard**: Fits images to standard international paper format.
     * **US Letter**: Fits images to standard North American office format.
   * **Page Orientation**: Auto-detect (scans aspect ratio of the image), force Portrait, or force Landscape.
   * **Margins**: None (full-bleed pages), Thin (10pt), or Normal (25pt).

4. **Premium Frontend UI**:
   * Light and Dark color themes using native CSS custom properties.
   * Responsive column layout matching phone, tablet, and widescreen aspect ratios.
   * Glassmorphism headers, shadows, and status toasts.

5. **Backend Security & Temporary Storage Hygiene**:
   * Restricts Flask requests payload limit to 16MB.
   * Safe file handling via Werkzeug `secure_filename`.
   * **Self-Scrubbing Temporary Directories**: Scans the server folders on user uploads and conversion routes, purging temporary files older than 15 minutes to prevent local disk space exhaustion.

---

## Directory Structure

```text
convert IMG into PDF/
│
├── app.py                  # Main Flask backend server
├── requirements.txt        # Backend dependencies
│
├── static/
│   ├── css/
│   │   └── style.css       # Layouts, variables, transitions & custom themes
│   └── js/
│       └── script.js       # File staging, HTML5 reordering, API connector
│
├── templates/
│   └── index.html          # Dashboard templates UI
│
├── uploads/                # Temporary image uploads (Auto-generated)
└── generated_pdfs/         # Compiled PDF files (Auto-generated)
```

---

## Step-by-Step Setup Guide

### 1. Prerequisites
Ensure you have **Python 3.8+** installed on your system. You can check your version in a terminal or command prompt:
```bash
python --version
```
### 2. Clone Repository
```bash
git clone https://github.com/Mukulkumarpandey/Image-to-Text Converter
```

### 2. Extract Project & Open Terminal
Open your terminal (PowerShell or command prompt on Windows, Terminal on macOS/Linux) and navigate to the project directory:
```bash
cd "c:\Users\admin\Desktop\project\convert IMG into PDF"
```

### 3. Create a Virtual Environment (Recommended)
It is best practice to run Python apps inside a virtual environment to keep dependencies clean.

* **Windows**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
* **macOS / Linux**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 4. Install Dependencies
Install the required packages using the package manager `pip`:
```bash
pip install -r requirements.txt
```

### 5. Launch the Application
Run the Flask server script:
```bash
python app.py
```

You will see output indicating that the development server is active:
```text
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

### 6. Access the App
Open your web browser and go to:
[http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## File Conversion Pipeline Explanation

Here is how the application converts images behind the scenes:
1. **Upload**: User drags images into the dropzone. JavaScript triggers `XMLHttpRequest` uploads to `/api/upload`.
2. **Sanitization**: Flask sanitizes the filename to protect against attacks (like `../` directory traversal) and saves it with a UUID prefix in `/uploads/` to prevent collisions.
3. **Reordering**: The user changes the sequence of images inside the UI. The list order changes in the frontend JavaScript array.
4. **Rendering**: On submission, formatting choices and the ordered list are sent to `/api/convert`. The backend:
   * Translates transparent pixels in transparent PNGs or WEBP files to solid white.
   * Resizes each image with high-quality Lanczos resampling to fit inside the margins of the selected page size (A4 / Letter).
   * Compiles the pages into a single PDF document.
5. **Download**: The user downloads the PDF from `/download/<id>`.
6. **Cleanup**: Files older than 15 minutes are removed automatically.

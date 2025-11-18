# Document Translator App

End-to-end document translation: upload PDF documents or images, OCR the text, translate to a target language, and render new documents/images with translated text overlaid while preserving layout, images, and visual elements.

## Prerequisites

- Node.js 20+
- Windows 10+ (works cross-platform as well)

## Prerequisites

- Python 3.8+ with pip
- Tesseract OCR installed on your system
- Node.js 20+ (for frontend)

### Install Tesseract OCR

**Windows:**
- Download from: https://github.com/UB-Mannheim/tesseract/wiki
- Add to PATH or set TESSDATA_PREFIX environment variable

**macOS:**
```bash
brew install tesseract
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr
```

### Install Poppler (Required for PDF processing)

**Windows:**
- Download from: https://github.com/oschwartz10612/poppler-windows/releases/
- Extract to `C:\poppler` (or any folder you prefer)
- Add `C:\poppler\Library\bin` to your PATH environment variable
- Restart your terminal/VS Code

**macOS:**
```bash
brew install poppler
```

**Linux:**
```bash
sudo apt-get install poppler-utils
```

## Setup

### Backend (Python with Virtual Environment)

**Windows PowerShell:**
```powershell
cd server
.\setup_venv.ps1
```

**Windows Command Prompt:**
```cmd
cd server
setup_venv.bat
```

**Manual setup (PowerShell):**
```powershell
cd server
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

**Manual setup (Command Prompt):**
```cmd
cd server
python -m venv venv
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
```

### Frontend
```bash
cd client
npm install
```

## Run

### Start the Python backend:

**Windows PowerShell:**
```powershell
cd server
.\start_server.ps1
```

**Windows Command Prompt:**
```cmd
cd server
start_server.bat
```

**Manual (PowerShell):**
```powershell
cd server
.\venv\Scripts\Activate.ps1
python run.py
```

**Manual (Command Prompt):**
```cmd
cd server
call venv\Scripts\activate.bat
python run.py
```

Start the React frontend (in another PowerShell/Command Prompt):
```powershell
cd client
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). The client proxies API calls to the Python server on port 5174.

## API Documentation

Visit `http://localhost:5174/docs` for interactive API documentation.

## Features

- **Image Translation**: Upload single images and get translated versions
- **Document Translation**: Upload PDF documents and get translated PDFs
- **Layout Preservation**: Maintains original document structure, images, and formatting
- **High-Quality OCR**: Uses Tesseract for accurate text detection
- **Batch Processing**: Handles multi-page documents automatically
- **Multiple Languages**: Supports 100+ languages via Google Translate

## Technical Stack

- **OCR**: `pytesseract` (Python wrapper for Tesseract OCR)
- **Translation**: `googletrans` (unofficial Google Translate API). For production, replace with a paid provider (e.g., Google Cloud Translate, Azure, DeepL).
- **Image Processing**: `Pillow` (PIL) for image manipulation and text overlay
- **PDF Processing**: `pdf2image` for PDF to image conversion, `reportlab` for PDF reconstruction
- **Backend**: FastAPI with automatic API documentation
- **Frontend**: React with Vite for fast development

## Environment

No required env vars for the demo. If you switch to a paid translation API, add credentials via environment variables.

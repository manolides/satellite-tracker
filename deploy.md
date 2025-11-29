# How to Publish Your Satellite Tracker

Here are three common ways to publish your static web application.

## Option 1: Netlify Drop (Easiest & Fastest)
Great for quickly sharing a link without setting up Git.

1.  Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2.  Open your file explorer to the folder containing your project:
    `/Users/mattmanolides/.gemini/antigravity/scratch/satellite_tracker`
3.  Drag and drop the **entire folder** onto the Netlify page.
4.  Netlify will generate a live URL for you instantly.

## Option 2: GitHub Pages (Best for Long-term)
Great if you want to maintain the code and have a professional workflow.

1.  **Initialize Git** (if you haven't already):
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    ```
2.  **Create a Repository on GitHub**:
    - Go to [github.com/new](https://github.com/new).
    - Name it `satellite-tracker`.
    - Do **not** initialize with README/gitignore (you have local files).
3.  **Push your code**:
    - Follow the instructions shown by GitHub to push an existing repository:
    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/satellite-tracker.git
    git branch -M main
    git push -u origin main
    ```
4.  **Enable GitHub Pages**:
    - Go to your repository **Settings** > **Pages**.
    - Under **Source**, select `Deploy from a branch`.
    - Select `main` branch and `/ (root)` folder.
    - Click **Save**.
    - Your site will be live at `https://YOUR_USERNAME.github.io/satellite-tracker/`.

## Option 3: Vercel
Great for performance and if you plan to add a framework later.

1.  Install Vercel CLI: `npm i -g vercel`
2.  Run `vercel` in your project folder.
3.  Follow the prompts.

## Option 4: Google Cloud Run
Great for scalability and serverless container deployment.

1.  **Install Google Cloud SDK**:
    -   [Download and install](https://cloud.google.com/sdk/docs/install) if you haven't already.

2.  **Login and Configure**:
    ```bash
    gcloud auth login
    gcloud config set project YOUR_PROJECT_ID
    ```

3.  **Deploy**:
    -   Run the following command in your project folder:
    ```bash
    gcloud run deploy satellite-tracker --source .
    ```
    -   When prompted for the region, select one close to you (e.g., `us-central1`).
    -   When prompted "Allow unauthenticated invocations?", answer `y` (yes) to make it public.

4.  **View**:
    -   The command will output a Service URL (e.g., `https://satellite-tracker-xyz-uc.a.run.app`). Click it to view your site.


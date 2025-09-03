# Technical Plan: Bookshelf Image Processing Microservice

This document outlines the technical specification for a microservice that processes images of bookshelves to identify and return structured data for each book.

## 1. High-Level Architecture

The service is designed to handle potentially long-running image processing tasks asynchronously without blocking the client. The end-to-end flow is as follows:

1.  **Image Upload:** The React Native client sends an image of a bookshelf to the API Gateway.
2.  **Request Acceptance:** The API Gateway forwards the request to the Image Processing Service, which validates the image and persists it in a temporary storage bucket (e.g., AWS S3).
3.  **Job Queuing:** The service creates a unique `job_id` for the request and places a message on a queue (e.g., AWS SQS) containing the `job_id` and the image location.
4.  **Immediate Response:** The service immediately returns a `202 Accepted` response to the client, including the `job_id`.
5.  **Asynchronous Processing:** A worker process, subscribed to the queue, picks up the message and begins the intensive processing workflow.
6.  **Data Enrichment:** The worker fetches book metadata from external APIs (e.g., Google Books API).
7.  **Result Storage:** Upon completion, the worker stores the final JSON result in a database (e.g., DynamoDB, Redis) using the `job_id` as the key.
8.  **Client Polling:** The React Native client periodically polls a results endpoint using the `job_id`.
9.  **Final Response:** Once the processing is complete, the results endpoint retrieves the JSON data from the database and returns it to the client.

### Architecture Diagram

```mermaid
sequenceDiagram
    participant Client as React Native App
    participant Gateway as API Gateway
    participant Service as Image Processing Service
    participant S3 as S3 Bucket
    participant SQS as Message Queue
    participant Worker as Processing Worker
    participant DB as Results Database
    participant ExtAPI as External Book APIs

    Client->>+Gateway: POST /v1/bookshelf/process (image)
    Gateway->>+Service: Forward Request
    Service->>+S3: Upload Image
    Service->>+SQS: Enqueue Job {job_id, image_path}
    Service-->>-Client: 202 Accepted {job_id}

    loop Client Polling
        Client->>+Gateway: GET /v1/bookshelf/results/{job_id}
        Gateway->>+Service: Forward Request
        Service->>+DB: Check for result
        alt Result Ready
            DB-->>-Service: Return JSON data
            Service-->>-Client: 200 OK [book1, book2, ...]
        else Result Not Ready
            DB-->>-Service: Not Found
            Service-->>-Client: 200 OK {status: 'processing'}
        end
    end

    activate Worker
    SQS->>+Worker: Dequeue Job
    Worker->>+S3: Download Image
    Note right of Worker: 1. Pre-process Image<br/>2. OCR on Spines<br/>3. Clean Text
    Worker->>+ExtAPI: Query Book APIs
    ExtAPI-->>-Worker: Return Book Metadata
    Worker->>+DB: Store Results {job_id, data}
    deactivate Worker
```


## 2. Technology Stack Recommendations

| Category                  | Recommendation                                                              | Justification                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend Language**      | **Python 3.9+** with **FastAPI**                                            | Python has a mature ecosystem for computer vision (OpenCV, Pillow) and data science. FastAPI is a modern, high-performance web framework that is easy to learn and use.      |
| **Computer Vision & OCR** | **Option A (Managed):** Google Cloud Vision API / AWS Rekognition             | **Pros:** High accuracy, fully managed, less implementation effort. **Cons:** Higher cost, less control over the processing pipeline. Ideal for a faster time-to-market. |
|                           | **Option B (Self-Hosted):** OpenCV & Tesseract OCR                          | **Pros:** Cost-effective, full control over pre-processing and OCR parameters. **Cons:** Lower out-of-the-box accuracy, requires more tuning and expertise.             |
| **Data Enrichment**       | **Google Books API** & **Open Library API**                                 | Using multiple sources provides better coverage and allows for cross-referencing results to improve accuracy. Both APIs are well-documented and offer free tiers.        |
| **Deployment**            | **Docker** with **AWS Fargate** or **Google Cloud Run**                     | Containerization ensures consistency across environments. Fargate/Cloud Run offer a serverless container experience, providing auto-scaling and cost-efficiency.        |
| **Infrastructure**        | - **API Gateway:** AWS API Gateway / Google Cloud Endpoints<br>- **Storage:** AWS S3 / Google Cloud Storage<br>- **Queue:** AWS SQS / Google Cloud Pub/Sub<br>- **Database:** AWS DynamoDB / Google Cloud Firestore | A cloud-native, serverless approach minimizes operational overhead, scales automatically, and follows a pay-per-use model, which is ideal for fluctuating workloads. |


## 3. Detailed Processing Workflow

The core logic of the processing worker is broken down into the following steps:

1.  **Image Reception and Validation:**
    *   The worker receives the `job_id` and `image_path` from the message queue.
    *   It downloads the image from the S3 bucket.
    *   Validates the image format (JPEG, PNG) and size (e.g., max 10MB).

2.  **Image Pre-processing:**
    *   **Perspective Correction:** Use OpenCV's `findContours` and `warpPerspective` to correct for skewed angles of the bookshelf.
    *   **Contrast & Brightness Adjustment:** Apply histogram equalization (e.g., `cv2.equalizeHist`) to enhance text clarity.
    *   **Spine Segmentation:** Employ edge detection (e.g., Canny edge detector) and contour analysis to identify the bounding boxes of individual book spines. This is a critical and complex step that may require significant tuning.

3.  **OCR Execution:**
    *   For each identified spine bounding box, crop the region of interest.
    *   Pass the cropped image to the OCR engine (Tesseract or a cloud API).
    *   The OCR engine returns the raw extracted text.

4.  **Text Cleaning and Parsing:**
    *   Remove common OCR errors and noise (e.g., special characters, single-letter artifacts).
    *   Attempt to split the text into potential titles and authors based on common patterns (e.g., line breaks, font size differences if available).

5.  **Data Enrichment & Fuzzy Matching:**
    *   For each parsed text block, construct queries for the Google Books and Open Library APIs.
    *   Use fuzzy string matching algorithms (e.g., `fuzzywuzzy` library's `token_set_ratio`) to compare the OCR text against the API search results.

6.  **Consolidation and Scoring:**
    *   Aggregate results from all external APIs.
    *   Assign a `confidenceScore` to each potential book match based on the quality of the fuzzy match and whether the result was found across multiple APIs.
    *   Select the highest-scoring match for each identified book spine.

7.  **Formatting Final Response:**
    *   Consolidate the best matches into a final list of book objects.
    *   Each object will contain `title`, `authors`, `isbn`, `coverUrl`, `description`, and the calculated `confidenceScore`.
    *   Store this final JSON array in the results database.


## 4. API Endpoint Design (RESTful)

### Primary Endpoint: Start Processing

*   **Endpoint:** `POST /v1/bookshelf/process`
*   **Description:** Submits a new bookshelf image for processing.
*   **Request Format:** `multipart/form-data`
    *   `image`: The image file (JPEG/PNG).
*   **Success Response:** `202 Accepted`
    *   **Body:**
        ```json
        {
          "job_id": "a-unique-identifier-for-the-job",
          "status": "processing"
        }
        ```

### Secondary Endpoint: Fetch Results

*   **Endpoint:** `GET /v1/bookshelf/results/{job_id}`
*   **Description:** Polls for the result of a processing job.
*   **Success Response (Processing):** `200 OK`
    *   **Body:**
        ```json
        {
          "job_id": "a-unique-identifier-for-the-job",
          "status": "processing"
        }
        ```
*   **Success Response (Complete):** `200 OK`
    *   **Body:**
        ```json
        {
          "job_id": "a-unique-identifier-for-the-job",
          "status": "complete",
          "books": [
            {
              "title": "The Hobbit",
              "authors": ["J.R.R. Tolkien"],
              "isbn": "9780547928227",
              "coverUrl": "https://covers.openlibrary.org/b/id/8264487-L.jpg",
              "description": "A great adventure.",
              "confidenceScore": 0.95
            }
          ]
        }
        ```

### Error Responses

*   **`400 Bad Request`:** Invalid image format, file too large, or missing image.
    ```json
    {
      "error": "Invalid request payload."
    }
    ```
*   **`404 Not Found`:** The requested `job_id` does not exist.
    ```json
    {
      "error": "Job not found."
    }
    ```
*   **`500 Internal Server Error`:** An unexpected error occurred during processing.
    ```json
    {
      "error": "An internal error occurred."
    }
    ```

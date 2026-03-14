import os
import requests
import json
import logging

logger = logging.getLogger(__name__)

class GoogleSheetsService:
    """
    Service to synchronize candidate data to Google Sheets.
    Supports a 'web_app' mode using Google App Script to bypass complex OAuth.
    """
    
    def __init__(self):
        # The URL for the Google App Script Web App
        self.webapp_url = os.environ.get("GOOGLE_SHEET_WEBAPP_URL")
        
    def sync_candidate(self, candidate_data: dict) -> bool:
        """
        Sends candidate details to the configured Google Sheet.
        Expected data: {id, name, email, role, company, match_score, location}
        """
        if not self.webapp_url:
            logger.warning("GOOGLE_SHEET_WEBAPP_URL not set. Skipping sheet sync.")
            # We return True anyway to not block the main flow if the user hasn't set it up yet
            return True
            
        try:
            # Prepare the row data
            payload = {
                "action": "append_candidate",
                "candidate": {
                    "ID": candidate_data.get("id"),
                    "Name": candidate_data.get("name"),
                    "Email": candidate_data.get("email"),
                    "Role": candidate_data.get("role"),
                    "Company": candidate_data.get("currentCompany"),
                    "Score": candidate_data.get("matchScore"),
                    "Location": candidate_data.get("location"),
                    "Status": "Interview Scheduled"
                }
            }
            
            logger.info(f"Syncing candidate {candidate_data.get('name')} to Google Sheets...")
            
            # Use a short timeout to prevent blocking the worker
            response = requests.post(
                self.webapp_url, 
                json=payload, 
                timeout=5,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                logger.info("Successfully synced to Google Sheets.")
                return True
            else:
                logger.error(f"Failed to sync to Google Sheets: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error syncing to Google Sheets: {str(e)}")
            return False

    def get_schedule(self) -> list:
        """
        Fetches the scheduled instances from the Google Sheet.
        Requires the App Script to have a doGet() function that returns the sheet data as JSON.
        """
        if not self.webapp_url:
            return []
            
        try:
            response = requests.get(self.webapp_url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # If App Script returns rows, they are usually in 'rows' or 'data' key
                return data.get("rows", []) if isinstance(data, dict) else data
            return []
        except Exception as e:
            logger.error(f"Error fetching from Google Sheets: {str(e)}")
            return []

# Global instance
google_sheets_service = GoogleSheetsService()

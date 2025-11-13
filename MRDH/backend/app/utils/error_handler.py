"""
Unified error handling utility
"""
from flask import jsonify
import traceback

def create_error_response(error, message="Operation failed", code=500):
    """
    Create unified error response
    
    Args:
        error: Exception object
        message: Error message
        code: HTTP status code
    
    Returns:
        Flask response object
    """
    error_details = str(error) if error else "Unknown error"
    
    response_data = {
        'code': code,
        'message': message,
        'error': error_details,
        'timestamp': None
    }
    
    # Add detailed error information in development environment
    try:
        import os
        if os.getenv('FLASK_ENV') == 'development':
            response_data['traceback'] = traceback.format_exc()
    except:
        pass
    
    print(f"❌ Error: {message} - {error_details}")
    
    return jsonify(response_data), code

def handle_api_error(func):
    """
    API error handling decorator
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            return create_error_response(e, f"{func.__name__} execution failed")
    
    wrapper.__name__ = func.__name__
    return wrapper

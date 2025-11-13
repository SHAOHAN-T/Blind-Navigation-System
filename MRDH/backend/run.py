"""
Flask application startup file
"""
import os
import sys
from datetime import datetime

# Add current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

try:
    from app import create_app
except ImportError as e:
    print(f"Failed to import app module: {e}")
    print("Please ensure you run this script in the backend directory")
    sys.exit(1)

# Create Flask application instance
app = create_app()

# Record startup time
app.start_time = datetime.now()

if __name__ == '__main__':

    try:
        app.run(
            host=app.config['HOST'],
            port=app.config['PORT'],
            debug=app.config['DEBUG']
        )
    except KeyboardInterrupt:
        print("\n" + "=" * 60)
        print("🛑 Service has stopped")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ Startup failed: {e}")
        print("Please check if the port is in use or configuration is correct")

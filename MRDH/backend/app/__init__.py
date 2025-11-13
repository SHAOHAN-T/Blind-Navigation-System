"""
Flask application factory
"""
import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask

# Flask-CORS is optional
try:
    from flask_cors import CORS
    HAS_CORS = True
except ImportError:
    HAS_CORS = False
    print("Warning: Flask-CORS not installed, CORS functionality will be unavailable")

def create_app(config_name='default'):
    """Create Flask application instance"""
    # Set template and static file paths
    template_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates')
    static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static')
    
    app = Flask(__name__, 
                template_folder=template_dir,
                static_folder=static_dir)
    
    # Import configuration
    try:
        from config import config
        app.config.from_object(config[config_name])
        
        # Initialize configuration
        config[config_name].init_app(app)
    except ImportError as e:
        print(f"Configuration import failed: {e}")
        # Use default configuration
        app.config.update({
            'SECRET_KEY': 'dev-secret-key',
            'DEBUG': True,
            'HOST': '0.0.0.0',
            'PORT': 5000,
            'DATA_DIR': os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data'),
            'AUDIO_DIR': os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static', 'audio'),
            'CORS_ORIGINS': ['*']
        })
        
        # Create necessary directories
        os.makedirs(app.config['DATA_DIR'], exist_ok=True)
        os.makedirs(os.path.join(app.config['DATA_DIR'], 'maps'), exist_ok=True)
        os.makedirs(os.path.join(app.config['DATA_DIR'], 'logs'), exist_ok=True)
        os.makedirs(app.config['AUDIO_DIR'], exist_ok=True)
    
    # Initialize CORS (if available)
    if HAS_CORS:
        CORS(app, origins=app.config.get('CORS_ORIGINS', ['*']))
    else:
        print("CORS functionality unavailable, install if needed: pip install Flask-CORS")
    
    # Register blueprints
    try:
        from .api.map_api import map_bp
        from .api.map_3d_api import map_3d_bp
        from .api.navigation_api import navigation_bp
        from .api.system_api import system_bp
        
        app.register_blueprint(map_bp, url_prefix='/api/maps')
        app.register_blueprint(map_3d_bp)  # 3D Map API, already includes url_prefix
        app.register_blueprint(navigation_bp, url_prefix='/api/navigation')
        app.register_blueprint(system_bp, url_prefix='/api/system')
        
        # Register main page routes
        from .routes import main_bp
        app.register_blueprint(main_bp)
        
    except ImportError as e:
        print(f"Blueprint import failed: {e}")
        
        # Create a simple health check route
        @app.route('/')
        def health_check():
            return {'status': 'ok', 'message': 'Navigation System Backend Service is Running'}
        
        @app.route('/api/health')
        def api_health():
            return {'status': 'ok', 'message': 'API Service is Normal'}
    
    print("\n" + "=" * 60)
    print("✅ Application initialized (Local Voice Templates)")
    print("=" * 60 + "\n")
    
    return app
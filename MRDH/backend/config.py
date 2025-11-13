"""
Application configuration file
"""
import os

class Config:
    """Base configuration class"""
    
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-for-navigation'
    DEBUG = True
    
    # Server configuration
    HOST = '0.0.0.0'  # Bind all interfaces, support real device debugging
    PORT = 5000
    
    # Data storage configuration
    DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    MAPS_DIR = os.path.join(DATA_DIR, 'maps')
    LOGS_DIR = os.path.join(DATA_DIR, 'logs')
    
    # Audio configuration
    AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'audio')
    AUDIO_FORMAT = 'mp3'
    AUDIO_CACHE_SIZE = 100  # Maximum cached audio files
    
    # Map configuration
    MAX_MAP_WIDTH = 100
    MAX_MAP_HEIGHT = 100
    DEFAULT_MAP_WIDTH = 20
    DEFAULT_MAP_HEIGHT = 15
    
    # Path planning configuration
    MAX_PATH_LENGTH = 1000
    PATH_CACHE_TIMEOUT = 300  # Path cache time (seconds)
    
    # Voice configuration
    TTS_LANGUAGE = 'en'  # English broadcast
    TTS_SPEED = 1.0
    TTS_VOICE = 'default'
    
    # CORS configuration
    CORS_ORIGINS = ['*']  # Development environment allows all sources
    
    @staticmethod
    def init_app(app):
        """Initialize application configuration"""
        # Create necessary directories
        os.makedirs(Config.DATA_DIR, exist_ok=True)
        os.makedirs(Config.MAPS_DIR, exist_ok=True)
        os.makedirs(Config.LOGS_DIR, exist_ok=True)
        os.makedirs(Config.AUDIO_DIR, exist_ok=True)

class DevelopmentConfig(Config):
    """Development environment configuration"""
    DEBUG = True

class ProductionConfig(Config):
    """Production environment configuration"""
    DEBUG = False
    SECRET_KEY = os.environ.get('SECRET_KEY')

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

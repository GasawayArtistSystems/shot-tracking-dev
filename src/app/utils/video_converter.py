import ffmpeg
import os
import argparse
from typing import Optional

class VideoConverter:
    def __init__(self, input_path: str, output_path: Optional[str] = None):
        """
        Initialize the video converter.
        
        Args:
            input_path: Path to the input AVI file
            output_path: Optional path for the output WebM file. If not provided,
                        will use the same name as input file with .webm extension
        """
        self.input_path = input_path
        self.output_path = output_path or self._get_default_output_path()
        
    def _get_default_output_path(self) -> str:
        """Generate default output path by replacing .avi extension with .webm"""
        base_path = os.path.splitext(self.input_path)[0]
        return f"{base_path}.webm"
    
    def convert(self, video_bitrate: str = '1000k', audio_bitrate: str = '128k') -> None:
        """
        Convert AVI file to WebM format.
        
        Args:
            video_bitrate: Target video bitrate (default: '1000k')
            audio_bitrate: Target audio bitrate (default: '128k')
        """
        try:
            # Input stream
            stream = ffmpeg.input(self.input_path)
            
            # Set up conversion parameters
            stream = ffmpeg.output(
                stream,
                self.output_path,
                vcodec='libvpx-vp9',  # VP9 video codec
                acodec='libopus',     # Opus audio codec
                video_bitrate=video_bitrate,
                audio_bitrate=audio_bitrate,
                **{'cpu-used': 2}     # Speed/quality tradeoff (0-5, higher = faster)
            )
            
            # Run the conversion
            ffmpeg.run(stream, overwrite_output=True)
            print(f"Successfully converted {self.input_path} to {self.output_path}")
            
        except ffmpeg.Error as e:
            print(f"An error occurred: {e.stderr.decode()}")
        except Exception as e:
            print(f"An unexpected error occurred: {str(e)}")

def main():
    # Set up command line argument parser
    parser = argparse.ArgumentParser(description='Convert AVI video files to WebM format')
    parser.add_argument('input', help='Input AVI file path')
    parser.add_argument('-o', '--output', help='Output WebM file path (optional)')
    parser.add_argument('-vb', '--video-bitrate', default='1000k',
                        help='Video bitrate (default: 1000k)')
    parser.add_argument('-ab', '--audio-bitrate', default='128k',
                        help='Audio bitrate (default: 128k)')
    
    args = parser.parse_args()
    
    # Create converter instance and perform conversion
    converter = VideoConverter(args.input, args.output)
    converter.convert(args.video_bitrate, args.audio_bitrate)

if __name__ == '__main__':
    main()




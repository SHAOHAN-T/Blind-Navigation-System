"""
Pathfinding algorithm - BFS breadth-first search
"""
from collections import deque
from typing import List, Tuple, Optional, Dict
from app.models.map import MapModel

class BFSPathfinder:
    """BFS pathfinder"""
    
    def __init__(self, map_model: MapModel):
        self.map = map_model
        self.max_path_length = 1000  # Maximum path length limit
    
    def find_path(self, start: Tuple[int, int], end: Tuple[int, int]) -> Optional[List[Tuple[int, int]]]:
        """
        Use BFS algorithm to find shortest path from start to end
        
        Args:
            start: Start coordinates (x, y)
            end: End coordinates (x, y)
            
        Returns:
            List of path points, or None if unreachable
        """
        start_x, start_y = start
        end_x, end_y = end
        
        # Check if start and end points are valid
        if not self.map.is_walkable(start_x, start_y):
            raise ValueError("Start point is not walkable")
        
        if not self.map.is_walkable(end_x, end_y):
            raise ValueError("End point is not walkable")
        
        # If start point is the end point
        if start == end:
            return [start]
        
        # BFS initialization
        queue = deque([(start_x, start_y, 0)])  # (x, y, distance)
        visited = {(start_x, start_y): None}  # Record predecessor of each point
        
        # Directions: up, right, down, left
        directions = [(0, -1), (1, 0), (0, 1), (-1, 0)]
        
        while queue:
            current_x, current_y, distance = queue.popleft()
            
            # Check path length limit
            if distance > self.max_path_length:
                break
            
            # Check all neighbors
            for dx, dy in directions:
                next_x, next_y = current_x + dx, current_y + dy
                
                # Check if it is walkable and not visited
                if (next_x, next_y) not in visited and self.map.is_walkable(next_x, next_y):
                    visited[(next_x, next_y)] = (current_x, current_y)
                    
                    # Check if it has reached the target
                    if next_x == end_x and next_y == end_y:
                        return self._reconstruct_path(visited, start, end)
                    
                    queue.append((next_x, next_y, distance + 1))
        
        # Unable to find path
        return None
    
    def _reconstruct_path(self, visited: Dict, start: Tuple[int, int], end: Tuple[int, int]) -> List[Tuple[int, int]]:
        """Reconstruct path from visited dictionary"""
        path = []
        current = end
        
        while current is not None:
            path.append(current)
            current = visited[current]
        
        path.reverse()
        return path
    
    def find_path_to_room(self, room_id: str) -> Optional[List[Tuple[int, int]]]:
        """Path from entrance to specified room"""
        room = self.map.find_room_by_id(room_id)
        if not room:
            return None
        
        start = (self.map.entrance["x"], self.map.entrance["y"])
        end = (room["x"], room["y"])
        
        return self.find_path(start, end)
    
    def check_connectivity(self) -> Dict:
        """Check map connectivity, return reachable and unreachable rooms"""
        entrance = (self.map.entrance["x"], self.map.entrance["y"])
        reachable_rooms = []
        unreachable_rooms = []
        
        for room in self.map.rooms:
            room_pos = (room["x"], room["y"])
            path = self.find_path(entrance, room_pos)
            
            if path:
                reachable_rooms.append(room["id"])
            else:
                unreachable_rooms.append(room["id"])
        
        return {
            "reachable_rooms": reachable_rooms,
            "unreachable_rooms": unreachable_rooms,
            "total_rooms": len(self.map.rooms),
            "connectivity_ratio": len(reachable_rooms) / len(self.map.rooms) if self.map.rooms else 0
        }
    
    def estimate_time(self, path: List[Tuple[int, int]], speed_per_step: float = 1.0) -> float:
        """Estimate navigation time (seconds)"""
        if not path:
            return 0
        
        # Base time: each step 1 second
        base_time = len(path) * speed_per_step
        
        # Turn time: each turn 1 second extra
        turn_time = self._count_turns(path) * 1.0
        
        return base_time + turn_time
    
    def _count_turns(self, path: List[Tuple[int, int]]) -> int:
        """Count turns in the path"""
        if len(path) < 3:
            return 0
        
        turns = 0
        for i in range(1, len(path) - 1):
            prev_x, prev_y = path[i - 1]
            curr_x, curr_y = path[i]
            next_x, next_y = path[i + 1]
            
            # Calculate direction vector
            dir1 = (curr_x - prev_x, curr_y - prev_y)
            dir2 = (next_x - curr_x, next_y - curr_y)
            
            # If direction changes, it is a turn
            if dir1 != dir2:
                turns += 1
        
        return turns

class NavigationInstructions:
    """Navigation instruction generator"""
    
    def __init__(self):
        # Direction mapping
        self.directions = {
            (0, -1): "north",
            (1, 0): "east", 
            (0, 1): "south",
            (-1, 0): "west"
        }
        
        # Turn instruction mapping
        self.turn_instructions = {
            ("north", "east"): "Turn right",
            ("north", "west"): "Turn left",
            ("east", "south"): "Turn right",
            ("east", "north"): "Turn left",
            ("south", "west"): "Turn right",
            ("south", "east"): "Turn left",
            ("west", "north"): "Turn right",
            ("west", "south"): "Turn left"
        }
    
    def generate_instructions(self, path: List[Tuple[int, int]], target_room: str = None) -> List[str]:
        """Generate template-compatible English navigation instructions"""
        if not path or len(path) < 2:
            return ["You have reached your destination"]
        
        instructions = ["Start navigation. Please follow the guidance"]
        i = 0
        
        while i < len(path) - 1:
            # Calculate current direction
            current_pos = path[i]
            next_pos = path[i + 1]
            direction = self._get_direction(current_pos, next_pos)
            
            # Calculate number of consecutive straight steps
            steps = 1
            j = i + 1
            
            while j < len(path) - 1:
                next_direction = self._get_direction(path[j], path[j + 1])
                if next_direction == direction:
                    steps += 1
                    j += 1
                else:
                    break
            
            # 生成包含步数的指令（带调试信息）
            print(f"📍 位置 {current_pos} → {path[j]}, 方向: {direction}, 步数: {steps}")
            
            if steps == 1:
                inst = "Walk 1 step forward"
            else:
                inst = f"Walk {steps} steps forward"
            instructions.append(inst)
            print(f"   指令: {inst}")
            
            i = j
            
            # If there is another segment, generate turn instructions
            if i < len(path) - 1:
                next_direction = self._get_direction(path[i], path[i + 1])
                turn_instruction = self.turn_instructions.get((direction, next_direction))
                if turn_instruction:
                    instructions.append(turn_instruction)
                    print(f"   指令: {turn_instruction}")
        
        # Add arrival instructions
        instructions.append("You have reached your destination")
        print(f"\n✓ 总共生成 {len(instructions)} 条指令\n")
        
        return instructions
    
    def _get_direction(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> str:
        """Get direction from one position to another"""
        dx = to_pos[0] - from_pos[0]
        dy = to_pos[1] - from_pos[1]
        
        direction_vector = (1 if dx > 0 else -1 if dx < 0 else 0,
                           1 if dy > 0 else -1 if dy < 0 else 0)
        
        return self.directions.get(direction_vector, "unknown")
    
    def generate_detailed_instructions(self, path: List[Tuple[int, int]], target_room: str = None) -> List[Dict]:
        """Generate detailed navigation instructions (include position information)"""
        if not path or len(path) < 2:
            return [{"step": 1, "action": "ARRIVED", "description": "You are already at your destination"}]
        
        detailed_instructions = []
        step_number = 1
        i = 0
        
        while i < len(path) - 1:
            current_pos = path[i]
            next_pos = path[i + 1]
            direction = self._get_direction(current_pos, next_pos)
            
            # Calculate number of consecutive straight steps
            steps = 1
            j = i + 1
            
            while j < len(path) - 1:
                next_direction = self._get_direction(path[j], path[j + 1])
                if next_direction == direction:
                    steps += 1
                    j += 1
                else:
                    break
            
            # Generate detailed straight instructions
            instruction = {
                "step": step_number,
                "action": "FORWARD",
                "distance": steps,
                "description": f"Go straight for {steps} step{'s' if steps > 1 else ''}",
                "current_position": {"x": current_pos[0], "y": current_pos[1]},
                "next_position": {"x": path[j][0], "y": path[j][1]},
                "direction": direction
            }
            detailed_instructions.append(instruction)
            step_number += 1
            
            i = j
            
            # If there is another segment, generate turn instructions
            if i < len(path) - 1:
                next_direction = self._get_direction(path[i], path[i + 1])
                turn_instruction = self.turn_instructions.get((direction, next_direction))
                if turn_instruction:
                    instruction = {
                        "step": step_number,
                        "action": "TURN",
                        "description": turn_instruction,
                        "current_position": {"x": path[i][0], "y": path[i][1]},
                        "from_direction": direction,
                        "to_direction": next_direction
                    }
                    detailed_instructions.append(instruction)
                    step_number += 1
        
        # Add arrival instructions
        final_pos = path[-1]
        arrival_instruction = {
            "step": step_number,
            "action": "ARRIVED",
            "description": f"You have arrived at {target_room}" if target_room else "You have arrived at your destination",
            "current_position": {"x": final_pos[0], "y": final_pos[1]}
        }
        detailed_instructions.append(arrival_instruction)
        
        return detailed_instructions

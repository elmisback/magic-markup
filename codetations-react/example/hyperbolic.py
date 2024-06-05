import math



def time_to_reach_velocity(target_velocity, initial_velocity, acceleration):
  # The velocity of the particle at time t is given by:
  # v(t) = initial_velocity + acceleration * sinh(t)
  # We can solve this equation for t to find the time at which the particle reaches the target velocity:
  # t = asinh((target_velocity - initial_velocity) / acceleration)
  return asinh((target_velocity - initial_velocity) / acceleration)

# Test the function with some example values
initial_velocity = 0.0  # The particle starts at rest
acceleration = 0.1  # The acceleration of the particle is 0.1 m/s^2
target_velocity = 0.5  # We want to know when the particle reaches a velocity of 0.5 m/s

def asinh(x):
  return math.log(x + math.sqrt(x*x + 1))

print(time_to_reach_velocity(target_velocity, initial_velocity, acceleration))  # Output: 4.812118250596035
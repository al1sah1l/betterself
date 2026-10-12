# GoalPlanning

## Purpose

Help a user define a self-directed goal and maintain a strategy for reaching it. Allow the strategy to change when the user learns that the current approach is not working.

## Principle

A user creates a goal by describing the desired outcome, current context, constraints, timeline, and definition of success. The user can define a strategy for reaching the goal and later revise it, but the user decides which strategy becomes the current strategy.

## Types

```types
external User
  The user who owns a goal.

opaque Strategy
  An ordered sequence of strategy steps. Each step has a description and a success criterion.
```

## State

```state
a set of Goals with
  an owner User
  an outcome String
  a currentContext String
  a constraints String
  a timeline String
  a successDefinition String
  an optional currentStrategy Strategy
  a createdAt DateTime
```

## Actions

```actions
createGoal(owner: User, outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String) : returns (goal: Goal)
  where true
  then
    add a new Goal with owner, outcome, currentContext, constraints, timeline, successDefinition, no currentStrategy, and the current creation time
    returns goal

setStrategy(goal: Goal, strategy: Strategy) : returns (goal: Goal)
  where goal is in Goals and goal has no currentStrategy
  then
    set the goal's currentStrategy to strategy
    returns goal
  where goal is not in Goals
  then
    refuses GOAL_NOT_FOUND "There is no such goal."
  where goal is in Goals and goal already has a currentStrategy
  then
    refuses STRATEGY_ALREADY_SET "This goal already has a strategy."

reviseStrategy(goal: Goal, strategy: Strategy) : returns (goal: Goal)
  where goal is in Goals and goal has a currentStrategy
  then
    replace the goal's currentStrategy with strategy
    returns goal
  where goal is not in Goals
  then
    refuses GOAL_NOT_FOUND "There is no such goal."
  where goal is in Goals and goal has no currentStrategy
  then
    refuses STRATEGY_NOT_SET "This goal does not have a strategy yet."

updateGoal(goal: Goal, outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String) : returns (goal: Goal)
  where goal is in Goals
  then
    update the goal's outcome, currentContext, constraints, timeline, and successDefinition
    returns goal
  where goal is not in Goals
  then
    refuses GOAL_NOT_FOUND "There is no such goal."

deleteGoal(goal: Goal) : returns (goal: Goal)
  where goal is in Goals
  then
    remove the goal from Goals
    returns goal
  where goal is not in Goals
  then
    refuses GOAL_NOT_FOUND "There is no such goal."
```

## Queries

```queries
_goal(goal: Goal) : optional (owner: User, outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String, currentStrategy?: Strategy)
  Returns the goal's current fields, or no row when the goal does not exist.

_goalsByOwner(owner: User) : many (goal: Goal, outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String, currentStrategy?: Strategy)
  Returns all goals owned by this user in creation order, or no rows when the user has no goals.
```
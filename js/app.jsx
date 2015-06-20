/*global React, Router, classNames*/
var app = app || {};

var cx = classNames;
var STORE_KEY = 'react-todos';

app.ALL_TODOS = 'all';
app.ACTIVE_TODOS = 'active';
app.COMPLETED_TODOS = 'completed';

var ESCAPE_KEY = 27;
var ENTER_KEY = 13;

var TodoModel = function (key) {
  this.key = key;
  this.subscribers = [];
  this.todos = app.Utils.store(this.key);
};

var modelProto = TodoModel.prototype;

modelProto.toggleAll = function () {
  if (this.isAllCompleted()) {
    this.todos = this.todos.map(function (todo) {
      return app.Utils.extend({}, todo, {completed: false});
    });
  } else {
    this.todos = this.todos.map(function (todo) {
      return app.Utils.extend({}, todo, {completed: true});
    });
  }
  this.inform();
};

modelProto.isAllCompleted = function () {
  var completedTodos = this.todos.filter(function (todo) {return todo.completed; });
  return completedTodos.length > 0 && this.todos.length === completedTodos.length;
};

modelProto.subscribe = function (subscriber) {
  this.subscribers.push(subscriber);
};

modelProto.addTodo = function (title) {
  var todo = {
    id: app.Utils.uuid(),
    title: title,
    completed: false
  };
  this.todos.push(todo);
  this.inform();
};

modelProto.inform = function () {
  app.Utils.store(this.key, this.todos);
  this.subscribers.forEach(function (subscriber) {
    subscriber();
  });
};

modelProto.deleteTodo = function (todoToDelete) {
  this.todos = this.todos.filter(function (todo) {
    return todo.id !== todoToDelete.id;
  });
  this.inform();
};

modelProto.toggleTodo = function (todoToToggle) {
  this.todos = this.todos.map(function (todo) {
    return (todo.id === todoToToggle.id) ? app.Utils.extend({}, todo, {completed: !todo.completed}) : todo;
  });
  this.inform();
};

modelProto.saveTodo = function (todoToSave, newTitle) {
  this.todos = this.todos.map(function (todo) {
    return (todo.id === todoToSave.id) ? app.Utils.extend({}, todo, {title: newTitle}) : todo;
  });
  this.inform();
};

modelProto.clearCompleted = function () {
  this.todos = this.todos.filter(function (todo) {
    return !todo.completed;
  });
  this.inform();
};

var TodoItem = React.createClass({
  getInitialState: function () {
    return {
      editingText: this.props.todo.title
    };
  },
  componentDidUpdate: function (prevProps) {
    if (!prevProps.editing && this.props.editing) {
      var node = this.refs.editField.getDOMNode();
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }
  },
  render: function () {

    return (
      <li className={cx({editing: this.props.editing, completed: this.props.todo.completed})}>
        <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={this.props.todo.completed}
          onChange={this.handleToggle}
          />
        <label
          onDoubleClick={this.handleDoubleClick}
          >{this.props.todo.title}</label>
        <button
          className="destroy"
          onClick={this.handleDelete}
        />
        </div>
        <input
          ref="editField"
          className="edit"
          onChange={this.handleChangeEditingText}
          onKeyDown={this.handleKeyDown}
          onBlur={this.handleBlur}
          value={this.state.editingText} />
      </li>
    );
  },

  handleToggle: function (e) {
    this.props.onToggle(this.props.todo);
  },
  handleDelete: function () {
    this.props.onDelete(this.props.todo);
  },
  handleDoubleClick: function (e) {
    this.setState({editingText: this.props.todo.title});
    this.props.onEditStart(this.props.todo);
  },
  handleChangeEditingText: function (e) {
    this.setState({editingText: e.target.value});
  },
  handleKeyDown: function (e) {
    if (e.which === ENTER_KEY) {
      var title = e.target.value.trim();
      this.saveEnteredTitle(title);
    } else if (e.which === ESCAPE_KEY) {
      this.setState({editingText: this.props.todo.title});
      this.props.onEditCancel();
    }
  },
  handleBlur: function (e) {
    var title = e.target.value.trim();
    this.saveEnteredTitle(title);
  },
  saveEnteredTitle: function(title) {
    if (title.length > 0) {
      this.props.onSave(this.props.todo, title);
      this.setState({editingText: title});
    } else {
      this.handleDelete();
      this.props.onEditCancel();
    }
  }

});

var TodoApp = React.createClass({
  getInitialState: function () {
    return {
      editingId: null,
      nowShowing: app.ALL_TODOS
    };
  },
  componentDidMount: function () {
    var router = Router({
      '/': this.setState.bind(this, {nowShowing: app.ALL_TODOS}),
      '/active': this.setState.bind(this, {nowShowing: app.ACTIVE_TODOS}),
      '/completed': this.setState.bind(this, {nowShowing: app.COMPLETED_TODOS})
    });
    router.init('/');
  },
  handleKeyDown: function (e) {
    if (e.which === ENTER_KEY) {
      this.addTodo(e.target.value.trim());
      e.target.value = '';
    }
  },
  addTodo: function(title) {
    this.props.model.addTodo(title);
  },
  render: function () {
    var todos = this.props.model.todos;

    var activeTodos = todos.filter(function (todo) {
      return !todo.completed;
    });
    var completedTodos = todos.filter(function (todo) {
      return todo.completed;
    });

    var nowShowing = this.state.nowShowing;

    var showingTodos = (nowShowing === app.ALL_TODOS) ? todos :
        (nowShowing === app.ACTIVE_TODOS) ? activeTodos :
        completedTodos;

    var todoItems = showingTodos.map(function (todo) {
      return (
        <TodoItem
          key={todo.id}
          todo={todo}
          editing={this.state.editingId === todo.id}
          onEditStart={this.startEdit}
          onEditCancel={this.cancelEdit}
          onDelete={this.deleteTodo}
          onToggle={this.toggleTodo}
          onSave={this.saveTodo}
        />
      );
    }, this);

    var clearButton = null;
    if (completedTodos.length > 0) {
      clearButton = (
        <button
          id="clear-completed"
          onClick={this.clearCompleted}
          >Clear completed</button>
      );
    }

    var main = null;
    var footer = null;
    if (todos.length > 0) {

      main = (
        <section id="main">
          <input
            id="toggle-all"
            onChange={this.toggleAll}
            checked={this.props.model.isAllCompleted()}
            type="checkbox" />
          <ul id="todo-list">
            {todoItems}
          </ul>
        </section>
      );

      footer = (
        <footer id="footer">
        <span id="todo-count">
        <strong>{activeTodos.length}</strong> {app.Utils.pluralize(activeTodos.length, 'item')} left
        </span>
        <ul id="filters">
        <li>
        <a href="#/" className={cx({selected: nowShowing === app.ALL_TODOS})}>All</a>
        </li>
        {' '}
        <li>
        <a href="#/active" className={cx({selected: nowShowing === app.ACTIVE_TODOS})}>Active</a>
        </li>
        {' '}
        <li>
        <a href="#/completed" className={cx({selected: nowShowing === app.COMPLETED_TODOS})}>Completed</a>
        </li>

        </ul>
        {clearButton}
        </footer>
      );
    }

    return (

      <div>
      <header id="header">
        <h1>todos</h1>
        <input
          id="new-todo"
          onKeyDown={this.handleKeyDown}
          autoFocus={true}
          placeholder="What needs to be done?" />
      </header>
      {main}

      {footer}

      </div>
    );
  },
  toggleAll: function () {
    this.props.model.toggleAll();
  },
  clearCompleted: function () {
    this.props.model.clearCompleted();
  },
  deleteTodo: function (todo) {
    this.props.model.deleteTodo(todo);
  },
  toggleTodo: function (todo) {
    this.props.model.toggleTodo(todo);
  },
  saveTodo: function (todo, newTitle) {
    this.props.model.saveTodo(todo, newTitle);
    this.setState({editingId: null});
  },
  startEdit: function (todo) {
    this.setState({editingId: todo.id});
  },
  cancelEdit: function (todo) {
    this.setState({editingId: null});
  }
});

var todoModel = new TodoModel(STORE_KEY);
var todoApp = <TodoApp model={todoModel} />;

function render() {
  React.render(
    todoApp,
    document.getElementById('todoapp')
  );
}

render();
todoModel.subscribe(render);





import sqlite3
from app.config import DATABASE

def execute_db_query(query, params=(), fetch=True, commit=False):
    """
    Execute a query against the database.

    Args:
        query (str): SQL query to execute.
        params (tuple): Parameters to use in the query.
        fetch (bool): Whether to fetch results (default is True).
        commit (bool): Whether to commit the transaction (default is False).

    Returns:
        list: Fetched rows if `fetch=True`, otherwise None.
    """
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        if commit:
            conn.commit()
        if fetch:
            return cursor.fetchall()




